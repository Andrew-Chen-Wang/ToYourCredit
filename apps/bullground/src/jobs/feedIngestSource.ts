import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { crudFeedItem } from "@lib/dao/feedItem/crud"
import { fetchFeedItem } from "@lib/dao/feedItem/fetch"
import { crudFeedSourceState } from "@lib/dao/feedSourceState/crud"
import { fetchFeedSourceState } from "@lib/dao/feedSourceState/fetch"
import { crudPost } from "@lib/dao/post/crud"
import { crudPostVote } from "@lib/dao/postVote/crud"
import { db } from "@template-nextjs/db"
import type { JobPayloadMap } from "@utils/queues"
import { enqueueEsSyncPost, enqueueLinkPreviewFetch } from "@utils/queues"
import { resolveAuthorUserId } from "../feeds/author"
import { classify } from "../feeds/classify"
import { gatherContent } from "../feeds/content"
import { fetchHtmlItems } from "../feeds/html"
import { isHttpUrl, normalizeUrl } from "../feeds/normalizeUrl"
import type { FeedItem } from "../feeds/parse"
import { parseFeed } from "../feeds/parse"
import { getSource, type FeedSource } from "../feeds/registry"

const FETCH_TIMEOUT_MS = 20 * 1000
const FEED_MAX_BYTES = 8 * 1024 * 1024
const USER_AGENT = "ReadItBot/1.0 (+feed-ingest)"

/** Ignore anything older than this so a first run does not import a site's whole archive. */
const MAX_ITEM_AGE_MS = 24 * 60 * 60 * 1000
/** Per source, per run. Keeps a high-volume wire from flooding the front page. */
const MAX_ITEMS_PER_RUN = 3
/** DB check constraint is 300; leave room for the ellipsis. */
const TITLE_MAX = 300

/** Truncates on a word boundary so a cut headline still reads as a headline. */
export function truncateTitle(title: string): string {
  const clean = title.replace(/\s+/g, " ").trim()
  if (clean.length <= TITLE_MAX) return clean
  const cut = clean.slice(0, TITLE_MAX - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > TITLE_MAX / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

interface FetchOutcome {
  items: FeedItem[]
  etag: string | null
  lastModified: string | null
  notModified: boolean
}

async function fetchFeed(source: FeedSource): Promise<FetchOutcome | null> {
  if (source.kind === "html") {
    if (!source.htmlRule) return null
    return {
      items: await fetchHtmlItems(source.htmlRule),
      etag: null,
      lastModified: null,
      notModified: false,
    }
  }
  if (!source.feedUrl) return null

  const state = await fetchFeedSourceState(db).getOne(source.id, ["etag", "lastModified"])
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  }
  if (state?.etag) headers["if-none-match"] = state.etag
  if (state?.lastModified) headers["if-modified-since"] = state.lastModified

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(source.feedUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers,
    })
    if (res.status === 304) {
      return {
        items: [],
        etag: state?.etag ?? null,
        lastModified: state?.lastModified ?? null,
        notModified: true,
      }
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const buffer = new Uint8Array(await res.arrayBuffer())
    if (buffer.byteLength === 0) throw new Error("empty response")
    if (buffer.byteLength > FEED_MAX_BYTES) throw new Error("feed too large")

    return {
      items: parseFeed(new TextDecoder().decode(buffer)),
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      notModified: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/** Community id by name, memoized for the process — the 103 names never change at runtime. */
const communityIdCache = new Map<string, string | null>()

async function resolveCommunityId(name: string): Promise<string | null> {
  const cached = communityIdCache.get(name)
  if (cached !== undefined) return cached
  const community = await fetchCommunity(db).getOneByName(name, ["id"])
  const id = community?.id ?? null
  if (!id) console.warn(`[feed-ingest] community ${name} does not exist`)
  communityIdCache.set(name, id)
  return id
}

export function resetCommunityCache(): void {
  communityIdCache.clear()
}

async function alreadyPosted(itemKeys: string[], urls: string[]): Promise<Set<string>> {
  const seen = await fetchFeedItem(db).existingItemKeys(itemKeys)
  if (urls.length > 0) {
    // Also respect links a human posted by hand, which have no feed_item row.
    const rows = await db
      .selectFrom("post")
      .select("linkUrl")
      .where("linkUrl", "in", urls)
      .execute()
    for (const row of rows) {
      const key = row.linkUrl ? normalizeUrl(row.linkUrl) : null
      if (key) seen.add(key)
    }
  }
  return seen
}

async function publish(
  source: FeedSource,
  item: FeedItem,
  itemKey: string,
  authorUserId: string,
): Promise<boolean> {
  // Claim the key first: the unique index is what makes concurrent runs and syndicated
  // duplicates safe, so nothing is posted until the claim succeeds.
  const claimed = await crudFeedItem(db).claim({ sourceId: source.id, itemKey })
  if (!claimed) return false

  try {
    const decision = await classify({
      candidates: source.communities,
      fallback: source.defaultCommunity,
      title: item.title,
      // Lazy: a single-community source never pays for this fetch.
      getContent: () => gatherContent(item),
    })

    const communityId = await resolveCommunityId(decision.community)
    if (!communityId) throw new Error(`unknown community ${decision.community}`)

    const canPost = await getCommunityAuthz(db).canPost(communityId, authorUserId)
    if (!canPost.ok) throw new Error(`cannot post to ${decision.community}: ${canPost.reason}`)

    const created = await crudPost(db).create({
      authorUserId,
      communityId,
      profileUserId: null,
      type: "link",
      title: truncateTitle(item.title),
      bodyMd: null,
      linkUrl: item.url,
      isNsfw: false,
      isSpoiler: false,
      isOc: false,
      flairTemplateId: null,
    })

    // Mirrors POST /api/v1/post: the author's own credit vote. Self-votes earn no karma.
    await crudPostVote(db).setVote(created.id, authorUserId, { type: "credit", active: true })
    await crudFeedItem(db).setPostId(claimed.id, created.id)
    await enqueueEsSyncPost(created.id)
    await enqueueLinkPreviewFetch(created.id, item.url)

    console.info(
      `[feed-ingest] ${source.id} -> r/${decision.community} (${decision.by}): ${created.id}`,
    )
    return true
  } catch (err: unknown) {
    // Release the claim so a later run can retry this item.
    await crudFeedItem(db).deleteById(claimed.id)
    throw err
  }
}

export async function processFeedIngestSource(
  data: JobPayloadMap["feed-ingest-source"],
): Promise<void> {
  const source = getSource(data.sourceId)
  if (!source) {
    console.warn(`[feed-ingest] unknown source ${data.sourceId}`)
    return
  }

  const authorUserId = await resolveAuthorUserId()
  if (!authorUserId) return

  let outcome: FetchOutcome | null
  try {
    outcome = await fetchFeed(source)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[feed-ingest] ${source.id} fetch failed: ${message}`)
    await crudFeedSourceState(db).markError(source.id, message)
    return
  }

  if (!outcome) {
    await crudFeedSourceState(db).markError(source.id, "source has no feed url or html rule")
    return
  }
  if (outcome.notModified) {
    await crudFeedSourceState(db).markOk(source.id, outcome)
    return
  }
  if (outcome.items.length === 0) {
    console.warn(`[feed-ingest] ${source.id} parsed 0 items — feed may have moved or changed shape`)
    await crudFeedSourceState(db).markError(source.id, "0 items parsed")
    return
  }

  const cutoff = Date.now() - MAX_ITEM_AGE_MS
  const candidates = outcome.items
    .filter((item) => item.title.length > 0 && isHttpUrl(item.url))
    // Undated items (typically scraped index pages) are kept — dedupe by URL is the guard there.
    .filter((item) => item.publishedAt === null || item.publishedAt.getTime() >= cutoff)
    .map((item) => ({ item, key: normalizeUrl(item.url) }))
    .filter((entry): entry is { item: FeedItem; key: string } => entry.key !== null)
    .toSorted((a, b) => (b.item.publishedAt?.getTime() ?? 0) - (a.item.publishedAt?.getTime() ?? 0))

  const seen = await alreadyPosted(
    candidates.map((c) => c.key),
    candidates.map((c) => c.item.url),
  )
  const fresh = candidates.filter((c) => !seen.has(c.key)).slice(0, MAX_ITEMS_PER_RUN)

  let posted = 0
  for (const { item, key } of fresh) {
    try {
      if (await publish(source, item, key, authorUserId)) posted++
    } catch (err: unknown) {
      console.warn(`[feed-ingest] ${source.id} could not post ${item.url}:`, err)
    }
  }

  await crudFeedSourceState(db).markOk(source.id, outcome)
  if (posted > 0) console.info(`[feed-ingest] ${source.id} posted ${posted} item(s)`)
}

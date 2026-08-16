import type { FeedItem } from "./parse"
import { stripHtml } from "./parse"
import { isHttpUrl, videoIdFromUrl } from "./normalizeUrl"

// Scrape adapter for the minority of sources that publish neither RSS/Atom nor a news sitemap.
// This is the fragile tier: a redesign silently drops item counts to zero, which shows up as a
// "0 items" warning and a stale `feed_source_state`.

const FETCH_TIMEOUT_MS = 12 * 1000
const HTML_MAX_BYTES = 4 * 1024 * 1024
const USER_AGENT = "ReadItBot/1.0 (+feed-ingest)"
const ROBOTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000

export interface HtmlRule {
  /** Index page listing recent articles. */
  indexUrl: string
  /**
   * Regex over the raw HTML with two capture groups: the article href and its link text.
   * Must be authored per source and re-checked when a site changes.
   */
  linkPattern: string
  /** Only keep hrefs whose resolved path matches this, e.g. "^/20\\d\\d/" for dated articles. */
  pathPattern?: string
}

const robotsCache = new Map<string, { disallow: string[]; fetchedAt: number }>()

async function fetchWithTimeout(url: string, accept: string): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Disallow rules that apply to us: the `*` group plus any group naming our bot. */
function parseRobots(body: string): string[] {
  const disallow: string[] = []
  let applies = false
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim()
    if (!line) continue
    const [rawKey, ...rest] = line.split(":")
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(":").trim()
    if (key === "user-agent") {
      const ua = value.toLowerCase()
      applies = ua === "*" || ua.includes("readitbot")
    } else if (key === "disallow" && applies && value) {
      disallow.push(value)
    }
  }
  return disallow
}

/**
 * Whether robots.txt permits fetching `url`. A missing or unreachable robots.txt is treated as
 * permissive (the convention); a robots.txt we can read and that disallows the path is honored.
 */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }

  const origin = target.origin
  const cached = robotsCache.get(origin)
  const fresh = cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS

  let disallow: string[]
  if (fresh) {
    disallow = cached.disallow
  } else {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, "text/plain")
    disallow = res?.ok ? parseRobots(await res.text()) : []
    robotsCache.set(origin, { disallow, fetchedAt: Date.now() })
  }

  const path = target.pathname + target.search
  return !disallow.some((rule) => rule !== "" && path.startsWith(rule))
}

/**
 * Scrapes an index page into feed items. Titles come from link text, so they are usually the
 * headline; there are no dates, which means the caller's age filter cannot apply and dedupe by
 * URL is doing all the work.
 */
export async function fetchHtmlItems(rule: HtmlRule): Promise<FeedItem[]> {
  if (!(await isAllowedByRobots(rule.indexUrl))) {
    console.warn(`[feed-ingest] robots.txt disallows ${rule.indexUrl}; skipping`)
    return []
  }

  const res = await fetchWithTimeout(rule.indexUrl, "text/html,application/xhtml+xml")
  if (!res?.ok) return []
  const buffer = new Uint8Array(await res.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > HTML_MAX_BYTES) return []
  const html = new TextDecoder().decode(buffer)

  const linkRe = new RegExp(rule.linkPattern, "gi")
  const pathRe = rule.pathPattern ? new RegExp(rule.pathPattern) : null

  const seen = new Set<string>()
  const items: FeedItem[] = []

  for (const match of html.matchAll(linkRe)) {
    const href = match[1]
    const title = stripHtml(match[2] ?? "")
    if (!href || !title) continue

    let absolute: string
    try {
      absolute = new URL(href, rule.indexUrl).toString()
    } catch {
      continue
    }
    if (!isHttpUrl(absolute)) continue
    if (pathRe && !pathRe.test(new URL(absolute).pathname)) continue
    if (seen.has(absolute)) continue
    seen.add(absolute)

    items.push({
      title,
      url: absolute,
      // Index pages rarely carry a reliable timestamp; undated items are kept and deduped by URL.
      publishedAt: null,
      summary: "",
      videoId: videoIdFromUrl(absolute),
    })
  }

  return items
}

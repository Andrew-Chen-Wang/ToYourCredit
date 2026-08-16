// Fetches and parses every active feed, reporting which ones have gone stale.
//
//   pnpm --filter=bullground run feeds:check
//   pnpm --filter=bullground run feeds:check -- reuters ap-news    # just these
//
// Feeds rot silently: a site redesign turns a working feed into an HTML page or a 403, and the
// only symptom in production is a community that quietly stops receiving posts. Run this when
// `feed_source_state.last_status` starts showing errors, or before trusting the registry.

import type { FeedSource } from "../feeds/registry"
import { ACTIVE_SOURCES, getSource } from "../feeds/registry"
import { parseFeed } from "../feeds/parse"

const USER_AGENT = "ReadItBot/1.0 (+feed-ingest)"
const TIMEOUT_MS = 25 * 1000
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000
const CONCURRENCY = 6

interface Result {
  id: string
  status: string
  parsed: number
  fresh: number
  note: string
}

async function check(source: FeedSource): Promise<Result> {
  const base = { id: source.id, parsed: 0, fresh: 0 }
  if (!source.feedUrl) {
    return {
      ...base,
      status: "-",
      note: source.kind === "html" ? "html rule (not checked)" : "no url",
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, TIMEOUT_MS)
  try {
    const res = await fetch(source.feedUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT },
    })
    if (!res.ok) return { ...base, status: String(res.status), note: "HTTP error" }

    const items = parseFeed(await res.text())
    const fresh = items.filter(
      (i) => i.publishedAt !== null && Date.now() - i.publishedAt.getTime() < FRESH_WINDOW_MS,
    ).length

    let note = ""
    if (items.length === 0) note = "PARSED ZERO — feed moved or changed shape"
    else if (items.every((i) => i.publishedAt === null)) note = "no dates (age filter cannot apply)"

    return { id: source.id, status: String(res.status), parsed: items.length, fresh, note }
  } catch (err: unknown) {
    return { ...base, status: "ERR", note: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timeout)
  }
}

const requested = process.argv.slice(2)
const targets =
  requested.length > 0
    ? requested.map((id) => getSource(id)).filter((s): s is FeedSource => s !== undefined)
    : ACTIVE_SOURCES

const results: Result[] = []
for (let i = 0; i < targets.length; i += CONCURRENCY) {
  results.push(...(await Promise.all(targets.slice(i, i + CONCURRENCY).map(check))))
}

for (const r of results) {
  const flag = r.status === "200" && r.parsed > 0 ? "  " : "!!"
  console.info(
    `${flag} ${r.id.padEnd(26)} ${r.status.padEnd(4)} parsed=${String(r.parsed).padEnd(5)} fresh24h=${String(r.fresh).padEnd(5)} ${r.note}`,
  )
}

const broken = results.filter((r) => r.status !== "200" || r.parsed === 0)
console.info(`\n${results.length - broken.length}/${results.length} healthy`)
if (broken.length > 0) {
  console.info(`needs attention: ${broken.map((b) => b.id).join(", ")}`)
}
process.exit(broken.length > 0 ? 1 : 0)

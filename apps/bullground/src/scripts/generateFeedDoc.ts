// Regenerates docs/feed-registry.md from the registry.
//
//   pnpm --filter=bullground run feeds:doc
//
// Run this after editing src/feeds/sources.ts so the doc never drifts from the code.

import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { FeedSource } from "../feeds/registry"
import { SOURCES } from "../feeds/registry"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const active = SOURCES.filter((s) => s.kind !== "none")
const unusable = SOURCES.filter((s) => s.kind === "none")

const byKind = new Map<string, number>()
for (const s of active) byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1)

function row(s: FeedSource): string {
  const feed = s.feedUrl ?? s.htmlRule?.indexUrl ?? "—"
  const communities =
    s.communities.length > 4
      ? `${s.communities.slice(0, 3).join(", ")} … (${s.communities.length})`
      : s.communities.join(", ")
  return `| \`${s.id}\` | ${s.name} | ${s.kind} | <${feed}> | ${s.language} | ${communities} | \`${s.defaultCommunity}\` |`
}

const lines = [
  "# Feed registry",
  "",
  "Resolved feed for every source named in [`topics-and-sources.md`](./topics-and-sources.md).",
  "To add or repair a source, read [`adding-a-feed-source.md`](./adding-a-feed-source.md) first —",
  "it covers `robots.txt` sitemap discovery and how to recover dates a feed does not declare.",
  "",
  "**Generated — do not edit.** The source of truth is `apps/bullground/src/feeds/sources.ts`;",
  "regenerate with `pnpm --filter=bullground run feeds:doc`.",
  "",
  `**${SOURCES.length} sources: ${active.length} active, ${unusable.length} with no usable feed.**`,
  "",
  `Active by kind: ${[...byKind.entries()].map(([k, n]) => `${k} ${n}`).join(", ")}.`,
  "",
  "Every feed URL below was fetched and parsed before being added. Resolution order was",
  "RSS/Atom → YouTube channel Atom → news sitemap → scraped index page → unusable.",
  "Check them again at any time with `pnpm --filter=bullground run feeds:check`.",
  "",
  "## Active sources",
  "",
  "| id | name | kind | feed | lang | communities | default |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...active.map(row),
  "",
  "## Sources with no usable feed",
  "",
  "Kept in the registry (with `kind: none`, never fetched) so the next person does not spend an",
  "afternoon rediscovering the same dead ends.",
  "",
  "| id | name | why |",
  "| --- | --- | --- |",
  ...unusable.map((s) => `| \`${s.id}\` | ${s.name} | ${s.notes ?? "—"} |`),
  "",
  "## Notes",
  "",
  "- A source feeding more than one community is classified per article (Claude when a credential",
  "  is configured, keyword scoring otherwise); a single-community source skips that step and",
  "  never fetches article content at all.",
  "- `feed_source_state.last_status` is the staleness signal. A source that starts returning zero",
  "  parsed items is recorded as an error rather than silently going quiet.",
  "",
]

writeFileSync(`${currentDir}/../../../../docs/feed-registry.md`, `${lines.join("\n")}\n`)
console.info(`wrote docs/feed-registry.md (${active.length} active, ${unusable.length} unusable)`)

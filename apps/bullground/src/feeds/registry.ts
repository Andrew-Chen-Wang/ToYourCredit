import { isKnownCommunity } from "./communities"
import type { HtmlRule } from "./html"
import { SOURCE_DATA } from "./sources"

export type FeedKind = "rss" | "youtube" | "sitemap" | "html" | "none"

export interface FeedSource {
  /** Stable slug. Used as the BullMQ job id and the `feed_item.source_id` value — never rename. */
  id: string
  name: string
  homepage: string
  kind: FeedKind
  /** Absent for `kind: "html"` (use `htmlRule`) and for `kind: "none"`. */
  feedUrl?: string
  htmlRule?: HtmlRule
  /** Communities this source may post into. One entry means no classification is needed. */
  communities: string[]
  /** Used when the classifier cannot decide. Must appear in `communities`. */
  defaultCommunity: string
  language: string
  /** Why a source is `none`, or anything else worth knowing when it breaks. */
  notes?: string
}

function validate(sources: FeedSource[]): FeedSource[] {
  const seenIds = new Set<string>()
  for (const source of sources) {
    if (seenIds.has(source.id)) throw new Error(`[feed-registry] duplicate source id: ${source.id}`)
    seenIds.add(source.id)

    if (source.communities.length === 0) {
      throw new Error(`[feed-registry] ${source.id} lists no communities`)
    }
    for (const community of source.communities) {
      if (!isKnownCommunity(community)) {
        throw new Error(`[feed-registry] ${source.id} references unknown community ${community}`)
      }
    }
    if (!source.communities.includes(source.defaultCommunity)) {
      throw new Error(
        `[feed-registry] ${source.id} default ${source.defaultCommunity} is not in its communities`,
      )
    }
    if (source.kind === "html" && !source.htmlRule) {
      throw new Error(`[feed-registry] ${source.id} is kind "html" but has no htmlRule`)
    }
    if (source.kind !== "html" && source.kind !== "none" && !source.feedUrl) {
      throw new Error(`[feed-registry] ${source.id} is kind "${source.kind}" but has no feedUrl`)
    }
  }
  return sources
}

/** Every source we know about, including the ones with no usable feed. */
export const SOURCES: FeedSource[] = validate(SOURCE_DATA)

/** The sources actually polled each run. `none` sources stay in SOURCES for documentation only. */
export const ACTIVE_SOURCES: FeedSource[] = SOURCES.filter((s) => s.kind !== "none")

const byId = new Map(SOURCES.map((s) => [s.id, s]))

export function getSource(id: string): FeedSource | undefined {
  return byId.get(id)
}

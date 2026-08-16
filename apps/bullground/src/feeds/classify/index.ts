import { communityLabel } from "../communities"
import { classifyByKeyword } from "./keyword"
import { classifyByLlm } from "./llm"

export { classifyByKeyword, keywordsFor, scoreCommunity } from "./keyword"
export { isLlmAvailable } from "./llm"

export interface ClassifyInput {
  /** Communities this source is allowed to post into. */
  candidates: readonly string[]
  /** Used when nothing else decides — the source's own primary community. */
  fallback: string
  title: string
  /**
   * Lazily produces the article body or video transcript. Only called when there is genuinely a
   * choice to make — fetching a page (or a YouTube transcript) for a source that feeds exactly
   * one community is pure waste and a needless failure mode.
   */
  getContent: () => Promise<string>
}

export interface ClassifyResult {
  community: string
  by: "single" | "llm" | "keyword"
}

/**
 * Picks the destination community for one item.
 *
 * A source that only feeds one community short-circuits before any content is gathered — no
 * fetch, no model call, no scoring. Otherwise Claude decides when it is available (it sees the
 * body/transcript, not just the headline), and the keyword classifier decides when it is not.
 */
export async function classify(input: ClassifyInput): Promise<ClassifyResult> {
  const candidates = [...new Set(input.candidates)]

  if (candidates.length === 0) return { community: input.fallback, by: "single" }
  if (candidates.length === 1) return { community: candidates[0], by: "single" }

  // Only reached when there is a real choice, so the content fetch is never wasted.
  const content = await input.getContent()

  const viaLlm = await classifyByLlm(
    candidates.map((name) => ({ name, label: communityLabel(name) })),
    input.title,
    content,
  )
  if (viaLlm) return { community: viaLlm, by: "llm" }

  return {
    community: classifyByKeyword(candidates, input.title, input.fallback),
    by: "keyword",
  }
}

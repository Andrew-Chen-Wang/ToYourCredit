import { getTranscriptText } from "@utils/youtube-transcript"
import type { FeedItem } from "./parse"
import { stripHtml } from "./parse"

// Content gathered here is only ever fed to the classifier to decide which community a link
// belongs in. It is never stored and never republished — posts are link + title, no body.

const FETCH_TIMEOUT_MS = 12 * 1000
const HTML_MAX_BYTES = 2 * 1024 * 1024
const MAX_CHARS = 6000
const USER_AGENT = "ReadItBot/1.0 (+feed-ingest)"

/** Enough text that a headline like "Seoul responds" is no longer ambiguous. */
const ENOUGH_CHARS = 400

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    })
    if (!res.ok) return null
    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("html")) return null

    const buffer = new Uint8Array(await res.arrayBuffer())
    if (buffer.byteLength === 0 || buffer.byteLength > HTML_MAX_BYTES) return null
    return new TextDecoder().decode(buffer)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Prefers the article body; falls back to the meta description when the page is mostly chrome. */
function extractArticleText(html: string): string {
  const article = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1]
  const body = article ? stripHtml(article) : ""
  if (body.length >= ENOUGH_CHARS) return body

  const metaRe = /<meta\s+[^>]*>/gi
  for (const tag of html.match(metaRe) ?? []) {
    const prop = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    if (prop !== "og:description" && prop !== "description") continue
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (content) return [body, stripHtml(content)].filter(Boolean).join(" ")
  }

  // Nothing better available — whatever the page body yields is still a signal.
  return body || stripHtml(html).slice(0, MAX_CHARS)
}

/**
 * Text to classify an item by, beyond its title.
 *
 * - YouTube entries use the transcript, falling back to the video description.
 * - Everything else uses the feed's own summary when it is substantial, and otherwise fetches
 *   the page. Audio interviews and podcast episodes are not transcribed: they get their title
 *   plus whatever text body the post carries, the same as any article.
 *
 * Always resolves — a failure just means the classifier works from the title alone.
 */
export async function gatherContent(item: FeedItem): Promise<string> {
  if (item.videoId) {
    const transcript = await getTranscriptText(item.videoId)
    if (transcript) return transcript.slice(0, MAX_CHARS)
    return item.summary.slice(0, MAX_CHARS)
  }

  if (item.summary.length >= ENOUGH_CHARS) return item.summary.slice(0, MAX_CHARS)

  const html = await fetchText(item.url)
  if (!html) return item.summary.slice(0, MAX_CHARS)

  const extracted = extractArticleText(html)
  const best = extracted.length > item.summary.length ? extracted : item.summary
  return best.slice(0, MAX_CHARS)
}

// Vendored from https://github.com/Kakulukian/youtube-transcript (MIT). See VENDORED.md for
// what was kept, what changed, and how to port upstream fixes.
//
// Two undocumented YouTube surfaces are used, in order:
//   1. the InnerTube `player` endpoint, which returns caption tracks as JSON, and
//   2. the watch page, scraping `ytInitialPlayerResponse` out of an inline script.
// Both can break without notice; every failure here is expected and returns null rather than
// throwing, because transcripts only enrich classification and must never fail the caller.

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"
const INNERTUBE_CLIENT_VERSION = "20.10.38"
const INNERTUBE_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`
const WEB_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

const VIDEO_ID_RE =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i

const FETCH_TIMEOUT_MS = 15 * 1000
const CAPTION_MAX_BYTES = 4 * 1024 * 1024

export interface TranscriptSegment {
  text: string
  /** Start offset in milliseconds. */
  offset: number
  /** Duration in milliseconds. */
  duration: number
  lang: string
}

export interface TranscriptOptions {
  /** Preferred caption language code. Falls back to the video's default track if unavailable. */
  lang?: string
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
}

/** Extracts the 11-character video id from a watch URL, a short URL, or a bare id. */
export function extractVideoId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input)) return input
  return VIDEO_ID_RE.exec(input)?.[1] ?? null
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function readCaptionTracks(playerResponse: unknown): CaptionTrack[] {
  const tracks = (
    playerResponse as
      | { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: unknown } } }
      | undefined
  )?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks)) return []
  return tracks.filter(
    (t): t is CaptionTrack =>
      typeof (t as CaptionTrack)?.baseUrl === "string" &&
      typeof (t as CaptionTrack)?.languageCode === "string",
  )
}

/** Pulls the JSON object assigned to `var <name> = {...}` out of an inline script tag. */
function parseInlineJson(html: string, name: string): unknown {
  const token = `var ${name} = `
  const start = html.indexOf(token)
  if (start === -1) return null
  const from = start + token.length
  let depth = 0
  for (let i = from; i < html.length; i++) {
    const ch = html[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(from, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

async function tracksViaInnerTube(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetchWithTimeout(INNERTUBE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": INNERTUBE_USER_AGENT },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: INNERTUBE_CLIENT_VERSION } },
      videoId,
    }),
  })
  if (!res?.ok) return []
  try {
    return readCaptionTracks(await res.json())
  } catch {
    return []
  }
}

async function tracksViaWatchPage(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "user-agent": WEB_USER_AGENT },
  })
  if (!res?.ok) return []
  const html = await res.text()
  // A captcha interstitial means this IP is rate limited; there are no tracks to find.
  if (html.includes('class="g-recaptcha"')) return []
  return readCaptionTracks(parseInlineJson(html, "ytInitialPlayerResponse"))
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
}

/** YouTube serves two caption XML shapes; srv3 is the current one, the other is still in the wild. */
function parseCaptionXml(xml: string, lang: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []

  // srv3: <p t="startMs" d="durMs"><s>word</s>...</p>
  const paragraphs = xml.matchAll(/<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)
  for (const p of paragraphs) {
    const inner = p[3]
    const words = [...inner.matchAll(/<s[^>]*>([^<]*)<\/s>/g)].map((m) => m[1]).join("")
    const text = decodeEntities(words || inner.replace(/<[^>]+>/g, "")).trim()
    if (text) {
      segments.push({
        text,
        offset: parseInt(p[1], 10),
        duration: parseInt(p[2], 10),
        lang,
      })
    }
  }
  if (segments.length > 0) return segments

  // classic: <text start="seconds" dur="seconds">content</text>
  for (const t of xml.matchAll(/<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g)) {
    const text = decodeEntities(t[3]).trim()
    if (text) {
      segments.push({
        text,
        offset: Math.round(parseFloat(t[1]) * 1000),
        duration: Math.round(parseFloat(t[2]) * 1000),
        lang,
      })
    }
  }
  return segments
}

function pickTrack(tracks: CaptionTrack[], lang?: string): CaptionTrack | undefined {
  if (lang) {
    const exact = tracks.find((t) => t.languageCode === lang)
    if (exact) return exact
    const prefix = tracks.find((t) => t.languageCode.split("-")[0] === lang.split("-")[0])
    if (prefix) return prefix
  }
  return tracks[0]
}

/**
 * Fetches transcript segments for a video. Returns an empty array when the video has no
 * captions, has them disabled, is unavailable, or YouTube declines the request.
 */
export async function fetchTranscript(
  videoIdOrUrl: string,
  options: TranscriptOptions = {},
): Promise<TranscriptSegment[]> {
  const videoId = extractVideoId(videoIdOrUrl)
  if (!videoId) return []

  let tracks = await tracksViaInnerTube(videoId)
  if (tracks.length === 0) tracks = await tracksViaWatchPage(videoId)
  if (tracks.length === 0) return []

  const track = pickTrack(tracks, options.lang)
  if (!track) return []

  // SSRF guard: `baseUrl` comes from a response body, so never follow it off YouTube.
  let captionUrl: URL
  try {
    captionUrl = new URL(track.baseUrl)
  } catch {
    return []
  }
  if (captionUrl.protocol !== "https:") return []
  if (captionUrl.hostname !== "youtube.com" && !captionUrl.hostname.endsWith(".youtube.com")) {
    return []
  }

  const res = await fetchWithTimeout(captionUrl.toString(), {
    headers: { "user-agent": WEB_USER_AGENT },
  })
  if (!res?.ok) return []

  const buffer = new Uint8Array(await res.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > CAPTION_MAX_BYTES) return []

  return parseCaptionXml(new TextDecoder().decode(buffer), track.languageCode)
}

/**
 * Transcript as one plain-text string, or null when the video has none. Never throws — a missing
 * transcript is an ordinary outcome for callers that only use it to enrich something else.
 */
export async function getTranscriptText(
  videoIdOrUrl: string,
  options: TranscriptOptions = {},
): Promise<string | null> {
  try {
    const segments = await fetchTranscript(videoIdOrUrl, options)
    if (segments.length === 0) return null
    const text = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    return text.length > 0 ? text : null
  } catch (err: unknown) {
    console.warn(`[youtube-transcript] failed for ${videoIdOrUrl}:`, err)
    return null
  }
}

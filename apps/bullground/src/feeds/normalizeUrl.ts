// Tracking parameters that vary per feed/referrer while pointing at the same article. Stripping
// them is what lets `feed_item.item_key` be globally unique: two sources syndicating one article
// produce one key, so it gets posted once.
const TRACKING_PARAM_PREFIXES = ["utm_", "pk_", "mc_", "ns_", "at_", "ito_", "ncid"]
const TRACKING_PARAMS = new Set([
  "cmpid",
  "CMP",
  "cmp",
  "fbclid",
  "gclid",
  "guccounter",
  "guce_referrer",
  "guce_referrer_sig",
  "icid",
  "ind",
  "leadSource",
  "mbid",
  "partner",
  "ref",
  "referrer",
  "sh",
  "smid",
  "source",
  "sref",
  "srnd",
  "taid",
  "tpcc",
  "xid",
  "yptr",
])

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase()
  if (TRACKING_PARAMS.has(key) || TRACKING_PARAMS.has(lower)) return true
  return TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Canonical key for an article URL. Lowercases scheme/host, drops `www.`, strips tracking params
 * and the fragment, sorts the surviving query, and removes a trailing slash. YouTube watch URLs
 * collapse to a canonical `youtube.com/watch?v=<id>` so the same video from a channel feed and a
 * short link dedupe against each other.
 *
 * Returns null for anything that is not an http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null

  const host = url.hostname.toLowerCase().replace(/^www\./, "")

  // Collapse every YouTube URL shape to one canonical form.
  const videoId = youtubeVideoId(url, host)
  if (videoId) return `https://youtube.com/watch?v=${videoId}`

  const params = [...url.searchParams.entries()]
    .filter(([k]) => !isTrackingParam(k))
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  const query = params.length > 0 ? `?${params.map(([k, v]) => `${k}=${v}`).join("&")}` : ""
  const path = url.pathname.replace(/\/+$/, "")

  return `https://${host}${path}${query}`
}

/** The 11-character video id for any YouTube URL shape, or null. */
export function youtubeVideoId(url: URL, hostHint?: string): string | null {
  const host = hostHint ?? url.hostname.toLowerCase().replace(/^www\./, "")
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0]
    return /^[\w-]{11}$/.test(id) ? id : null
  }
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
    return null
  }
  const v = url.searchParams.get("v")
  if (v && /^[\w-]{11}$/.test(v)) return v
  const m = /^\/(?:embed|v|shorts|live)\/([\w-]{11})/.exec(url.pathname)
  return m ? m[1] : null
}

export function videoIdFromUrl(input: string): string | null {
  try {
    return youtubeVideoId(new URL(input))
  } catch {
    return null
  }
}

import { XMLParser } from "fast-xml-parser"
import { isHttpUrl, videoIdFromUrl } from "./normalizeUrl"

export interface FeedItem {
  title: string
  url: string
  /** Null when the feed gives no usable date; callers decide whether to keep undated items. */
  publishedAt: Date | null
  /** Feed-provided body/summary, already stripped of markup. Empty string when absent. */
  summary: string
  /** Set for YouTube entries so the caller can fetch a transcript. */
  videoId: string | null
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Keep everything a string: version numbers, ids and dates all break under numeric coercion.
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
})

type Node = Record<string, unknown>

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** Text of a node that may be a bare string, or an object carrying `#text` plus attributes. */
function text(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (value && typeof value === "object") {
    const t = (value as Node)["#text"]
    if (typeof t === "string") return t
    if (typeof t === "number") return String(t)
  }
  return ""
}

export function stripHtml(html: string): string {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;|&apos;/gi, "'")
      .replace(/\s+/g, " ")
      // Tags become spaces, so "<b>rate</b>." would otherwise leave a gap before the full stop.
      .replace(/\s+([.,;:!?%)\]}])/g, "$1")
      .replace(/([([{])\s+/g, "$1")
      .trim()
  )
}

// RFC-822 dates are supposed to use English month names, but localized feeds are common in a
// multilingual registry — Sky TG24 emits "lun, 17 ago 2026 10:00:00 GMT". `new Date()` returns
// Invalid Date for those, which silently made every item undated and exempt from the age filter.
// Keys are lowercased and accent-stripped before lookup.
// Unicode combining marks (U+0300..U+036F), built from code points so this file carries no
// invisible characters and no escape sequences that a tool or editor could mangle.
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
)

const MONTH_ALIASES: Record<string, string> = {
  gen: "Jan",
  ene: "Jan",
  jan: "Jan",
  janv: "Jan",
  feb: "Feb",
  fev: "Feb",
  fevr: "Feb",
  febr: "Feb",
  mar: "Mar",
  mars: "Mar",
  marz: "Mar",
  mrz: "Mar",
  apr: "Apr",
  abr: "Apr",
  avr: "Apr",
  mag: "May",
  may: "May",
  mai: "May",
  mei: "May",
  giu: "Jun",
  jun: "Jun",
  juin: "Jun",
  lug: "Jul",
  jul: "Jul",
  juil: "Jul",
  ago: "Aug",
  aug: "Aug",
  aout: "Aug",
  set: "Sep",
  sep: "Sep",
  sept: "Sep",
  ott: "Oct",
  oct: "Oct",
  okt: "Oct",
  out: "Oct",
  nov: "Nov",
  dic: "Dec",
  dec: "Dec",
  dez: "Dec",
  des: "Dec",
}

function parseDate(value: string): Date | null {
  if (!value) return null

  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct

  // Drop the localized weekday (everything up to the first comma), then translate the month.
  const normalized = value
    .replace(/^\s*[^\s,]+,\s*/, "")
    .replace(/^(\d{1,2}\s+)(\S+)/, (whole, day: string, month: string) => {
      const key = month
        .toLowerCase()
        .normalize("NFD")
        .replace(COMBINING_MARKS, "")
        .replace(/\.$/, "")
      const english =
        MONTH_ALIASES[key] ?? MONTH_ALIASES[key.slice(0, 4)] ?? MONTH_ALIASES[key.slice(0, 3)]
      return english ? `${day}${english}` : whole
    })

  const retry = new Date(normalized)
  return Number.isNaN(retry.getTime()) ? null : retry
}

// Last resort when a feed carries no date element at all. Publishing CMSes routinely date-stamp
// their asset and article paths, so the URLs in an item often know the publication date even when
// the XML does not — Hankyoreh's thumbnails sit under /2026/0816/, and plenty of sites use
// /2026/08/16/ in the article path itself. Only consulted when every date element is absent, so
// it can never override a real one.
const URL_DATE_PATTERNS = [
  /\/(20\d\d)\/(\d{2})(\d{2})\//, // /2026/0816/
  /\/(20\d\d)\/(\d{2})\/(\d{2})\//, // /2026/08/16/
  /[_-](20\d\d)(\d{2})(\d{2})[_-]/, // _20260816-
]

function dateFromUrls(...haystacks: string[]): Date | null {
  for (const haystack of haystacks) {
    if (!haystack) continue
    for (const pattern of URL_DATE_PATTERNS) {
      const m = pattern.exec(haystack)
      if (!m) continue
      const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
      if (month < 1 || month > 12 || day < 1 || day > 31) continue
      const d = new Date(Date.UTC(year, month - 1, day))
      // A path date is only a date, so it lands at midnight UTC. That is close enough for a
      // 24-hour freshness window; reject anything implausibly far in the future.
      if (d.getTime() > Date.now() + 2 * 24 * 60 * 60 * 1000) continue
      return d
    }
  }
  return null
}

/** Atom `link` is an array of typed refs; the readable page is rel="alternate" (or the first one). */
function atomLink(entry: Node): string {
  const links = asArray(entry.link)
  const candidates = links
    .map((l) => {
      if (typeof l === "string") return { href: l, rel: "alternate", type: "text/html" }
      const n = l as Node
      return {
        href: typeof n["@_href"] === "string" ? n["@_href"] : "",
        rel: typeof n["@_rel"] === "string" ? n["@_rel"] : "alternate",
        type: typeof n["@_type"] === "string" ? n["@_type"] : "",
      }
    })
    .filter((c) => c.href.length > 0)

  const alternate = candidates.find((c) => c.rel === "alternate")
  return (alternate ?? candidates[0])?.href ?? ""
}

function rssItems(channel: Node): FeedItem[] {
  return asArray(channel.item as Node | Node[]).flatMap((item) => {
    const title = stripHtml(text(item.title))
    // Some feeds put the URL only in a permalink guid.
    let url = text(item.link)
    if (!isHttpUrl(url)) {
      const guid = text(item.guid)
      if (isHttpUrl(guid)) url = guid
    }
    if (!title || !isHttpUrl(url)) return []

    const body = text(item["content:encoded"]) || text(item.description)
    return [
      {
        title,
        url,
        publishedAt:
          parseDate(text(item.pubDate) || text(item["dc:date"])) ?? dateFromUrls(body, url),
        summary: stripHtml(body),
        videoId: videoIdFromUrl(url),
      },
    ]
  })
}

function atomEntries(feed: Node): FeedItem[] {
  return asArray(feed.entry as Node | Node[]).flatMap((entry) => {
    const title = stripHtml(text(entry.title))
    const url = atomLink(entry)
    if (!title || !isHttpUrl(url)) return []

    // YouTube channel feeds carry the id directly and the blurb under media:group.
    const ytId = typeof entry["yt:videoId"] === "string" ? entry["yt:videoId"] : null
    const mediaGroup = entry["media:group"] as Node | undefined
    const body =
      text(entry.content) ||
      text(entry.summary) ||
      (mediaGroup ? text(mediaGroup["media:description"]) : "")

    return [
      {
        title,
        url,
        publishedAt:
          parseDate(text(entry.published) || text(entry.updated)) ?? dateFromUrls(body, url),
        summary: stripHtml(body),
        videoId: ytId ?? videoIdFromUrl(url),
      },
    ]
  })
}

function sitemapUrls(urlset: Node): FeedItem[] {
  return asArray(urlset.url as Node | Node[]).flatMap((entry) => {
    const url = text(entry.loc)
    if (!isHttpUrl(url)) return []

    const news = entry["news:news"] as Node | undefined
    const title = news ? stripHtml(text(news["news:title"])) : ""
    const published = news ? text(news["news:publication_date"]) : ""

    // A sitemap entry with no <news:news> block gives us no headline, and a link post needs one.
    if (!title) return []

    return [
      {
        title,
        url,
        publishedAt: parseDate(published || text(entry.lastmod)),
        summary: "",
        videoId: videoIdFromUrl(url),
      },
    ]
  })
}

/**
 * Parses RSS 2.0, RSS 1.0 (RDF), Atom (including YouTube channel feeds) and news sitemaps.
 * The document's own root element decides the shape — registry `kind` is a hint for how to
 * *fetch*, not a promise about what comes back, and plenty of "rss" URLs serve Atom.
 *
 * Returns an empty array rather than throwing on malformed input; the caller records that as a
 * failing source instead of failing the run.
 */
export function parseFeed(body: string): FeedItem[] {
  let doc: Node
  try {
    doc = parser.parse(body) as Node
  } catch {
    return []
  }

  const rss = doc.rss as Node | undefined
  if (rss?.channel) {
    return asArray(rss.channel as Node | Node[]).flatMap(rssItems)
  }

  const rdf = doc["rdf:RDF"] as Node | undefined
  if (rdf) return rssItems(rdf)

  const feed = doc.feed as Node | undefined
  if (feed) return atomEntries(feed)

  const urlset = doc.urlset as Node | undefined
  if (urlset) return sitemapUrls(urlset)

  return []
}

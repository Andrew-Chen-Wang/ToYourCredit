import { describe, expect, it } from "vitest"
import { parseFeed, stripHtml } from "./parse"

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example Wire</title>
    <item>
      <title>Tariffs on steel raised again</title>
      <link>https://example.com/a?utm_source=rss</link>
      <pubDate>Wed, 13 Aug 2026 09:00:00 GMT</pubDate>
      <description>&lt;p&gt;Ministers agreed a new &lt;b&gt;rate&lt;/b&gt;.&lt;/p&gt;</description>
    </item>
    <item>
      <title>Central bank holds rates</title>
      <guid isPermaLink="true">https://example.com/b</guid>
      <pubDate>Wed, 13 Aug 2026 08:00:00 GMT</pubDate>
      <content:encoded>Full body text here.</content:encoded>
    </item>
    <item>
      <title>No link at all</title>
    </item>
  </channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Blog</title>
  <entry>
    <title>A considered analysis</title>
    <link rel="edit" href="https://example.com/edit/1"/>
    <link rel="alternate" type="text/html" href="https://example.com/post/1"/>
    <published>2026-08-13T09:00:00Z</published>
    <summary>Some summary text.</summary>
  </entry>
</feed>`

const YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:videoId>dQw4w9WgXcQ</yt:videoId>
    <title>Why this city banned cars</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
    <published>2026-08-13T12:00:00+00:00</published>
    <media:group>
      <media:description>A look at the pedestrianisation programme.</media:description>
    </media:group>
  </entry>
</feed>`

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://example.com/news/one</loc>
    <news:news>
      <news:publication_date>2026-08-13T07:30:00Z</news:publication_date>
      <news:title>Coalition talks collapse</news:title>
    </news:news>
  </url>
  <url>
    <loc>https://example.com/static/about</loc>
    <lastmod>2026-08-01</lastmod>
  </url>
</urlset>`

describe("stripHtml", () => {
  it("removes markup, scripts and entities", () => {
    expect(stripHtml("<p>Hello <b>there</b></p><script>evil()</script>&amp; more")).toBe(
      "Hello there & more",
    )
  })
})

describe("parseFeed", () => {
  it("parses RSS items and falls back to a permalink guid for the url", () => {
    const items = parseFeed(RSS)
    // The third item has no url and is dropped.
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe("Tariffs on steel raised again")
    expect(items[0].url).toBe("https://example.com/a?utm_source=rss")
    expect(items[0].summary).toBe("Ministers agreed a new rate.")
    expect(items[0].publishedAt?.toISOString()).toBe("2026-08-13T09:00:00.000Z")
    expect(items[1].url).toBe("https://example.com/b")
    expect(items[1].summary).toBe("Full body text here.")
  })

  it("parses Atom and prefers the alternate link over other rels", () => {
    const items = parseFeed(ATOM)
    expect(items).toHaveLength(1)
    expect(items[0].url).toBe("https://example.com/post/1")
    expect(items[0].summary).toBe("Some summary text.")
  })

  it("parses YouTube channel feeds and surfaces the video id", () => {
    const items = parseFeed(YOUTUBE)
    expect(items).toHaveLength(1)
    expect(items[0].videoId).toBe("dQw4w9WgXcQ")
    expect(items[0].summary).toBe("A look at the pedestrianisation programme.")
  })

  it("parses news sitemaps and skips entries with no headline", () => {
    const items = parseFeed(SITEMAP)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe("Coalition talks collapse")
    expect(items[0].url).toBe("https://example.com/news/one")
  })

  it("parses localized RFC-822 dates, which JS Date alone rejects", () => {
    // Sky TG24 emits Italian weekday/month names. Before this was handled, every item came back
    // undated and therefore exempt from the freshness filter.
    const italian = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Titolo di prova</title>
        <link>https://example.com/it</link>
        <pubDate>lun, 17 ago 2026 10:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Ejemplo</title>
        <link>https://example.com/es</link>
        <pubDate>dom, 16 ago 2026 19:30:00 GMT</pubDate>
      </item>
      <item>
        <title>Beispiel</title>
        <link>https://example.com/de</link>
        <pubDate>Mo, 17 Mär 2026 08:15:00 GMT</pubDate>
      </item>
    </channel></rss>`

    const items = parseFeed(italian)
    expect(items).toHaveLength(3)
    expect(items[0].publishedAt?.toISOString()).toBe("2026-08-17T10:00:00.000Z")
    expect(items[1].publishedAt?.toISOString()).toBe("2026-08-16T19:30:00.000Z")
    expect(items[2].publishedAt?.toISOString()).toBe("2026-03-17T08:15:00.000Z")
  })

  it("still returns null for a genuinely unparseable date", () => {
    const bad = `<?xml version="1.0"?><rss version="2.0"><channel><item>
      <title>No date</title><link>https://example.com/x</link>
      <pubDate>sometime last week</pubDate>
    </item></channel></rss>`
    expect(parseFeed(bad)[0].publishedAt).toBeNull()
  })

  it("recovers a date from URLs when the feed carries no date element", () => {
    // Hankyoreh ships no pubDate/dc:date at all, but every item's thumbnail sits under
    // /YYYY/MMDD/. Without this the items are undated and skip the freshness filter entirely.
    const noDateTags = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Thumbnail carries the date</title>
        <link>https://www.hani.co.kr/arti/english_edition/e_national/1273074.html</link>
        <description><![CDATA[<img src=https://flexible.img.hani.co.kr/flexible/normal/300/180/imgdb/original/2026/0814/3717866960662286.webp border=0>]]></description>
      </item>
      <item>
        <title>Article path carries the date</title>
        <link>https://example.com/2026/08/14/some-headline.html</link>
      </item>
    </channel></rss>`

    const items = parseFeed(noDateTags)
    expect(items[0].publishedAt?.toISOString()).toBe("2026-08-14T00:00:00.000Z")
    expect(items[1].publishedAt?.toISOString()).toBe("2026-08-14T00:00:00.000Z")
  })

  it("never lets a URL date override a real date element", () => {
    const conflicting = `<?xml version="1.0"?><rss version="2.0"><channel><item>
      <title>Real date wins</title>
      <link>https://example.com/2020/01/02/old-path-slug.html</link>
      <pubDate>Wed, 13 Aug 2026 09:00:00 GMT</pubDate>
    </item></channel></rss>`
    expect(parseFeed(conflicting)[0].publishedAt?.toISOString()).toBe("2026-08-13T09:00:00.000Z")
  })

  it("ignores an implausible future URL date rather than trusting the path", () => {
    const future = `<?xml version="1.0"?><rss version="2.0"><channel><item>
      <title>Bogus path date</title>
      <link>https://example.com/2099/01/01/whatever.html</link>
    </item></channel></rss>`
    expect(parseFeed(future)[0].publishedAt).toBeNull()
  })

  it("returns an empty array for junk instead of throwing", () => {
    expect(parseFeed("<html><body>not a feed</body></html>")).toEqual([])
    expect(parseFeed("")).toEqual([])
    expect(parseFeed("<<<broken")).toEqual([])
  })
})

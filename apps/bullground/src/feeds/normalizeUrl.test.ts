import { describe, expect, it } from "vitest"
import { isHttpUrl, normalizeUrl, videoIdFromUrl } from "./normalizeUrl"

describe("isHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true)
    expect(isHttpUrl("http://example.com/a")).toBe(true)
    expect(isHttpUrl("ftp://example.com/a")).toBe(false)
    expect(isHttpUrl("javascript:alert(1)")).toBe(false)
    expect(isHttpUrl("/relative/path")).toBe(false)
    expect(isHttpUrl("")).toBe(false)
  })
})

describe("normalizeUrl", () => {
  it("canonicalises scheme, host and trailing slash", () => {
    expect(normalizeUrl("HTTP://WWW.Example.com/Story/")).toBe("https://example.com/Story")
  })

  it("collapses the same article arriving from two sources with different tracking params", () => {
    const a = normalizeUrl(
      "https://www.reuters.com/world/story-idX?utm_source=feedburner&utm_medium=rss",
    )
    const b = normalizeUrl("https://reuters.com/world/story-idX?fbclid=abc123")
    expect(a).toBe(b)
    expect(a).toBe("https://reuters.com/world/story-idX")
  })

  it("keeps meaningful query params and sorts them", () => {
    expect(normalizeUrl("https://example.com/p?b=2&a=1&utm_campaign=x")).toBe(
      "https://example.com/p?a=1&b=2",
    )
  })

  it("drops the fragment", () => {
    expect(normalizeUrl("https://example.com/p#section-3")).toBe("https://example.com/p")
  })

  it("collapses every youtube url shape to one key", () => {
    const canonical = "https://youtube.com/watch?v=dQw4w9WgXcQ"
    expect(normalizeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe(canonical)
    expect(normalizeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(canonical)
    expect(normalizeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(canonical)
    expect(normalizeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(canonical)
  })

  it("rejects non-http input", () => {
    expect(normalizeUrl("not a url")).toBeNull()
    expect(normalizeUrl("mailto:a@b.com")).toBeNull()
  })
})

describe("videoIdFromUrl", () => {
  it("extracts ids and returns null for non-youtube urls", () => {
    expect(videoIdFromUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(videoIdFromUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(videoIdFromUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull()
  })
})

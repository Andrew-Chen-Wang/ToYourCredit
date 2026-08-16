import { crudFeedItem } from "@lib/dao/feedItem/crud"
import { fetchFeedItem } from "@lib/dao/feedItem/fetch"
import { crudFeedSourceState } from "@lib/dao/feedSourceState/crud"
import { fetchFeedSourceState } from "@lib/dao/feedSourceState/fetch"
import { db } from "@template-nextjs/db"
import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, it } from "vitest"
import { truncateTitle } from "./feedIngestSource"

const suffix = randomUUID().slice(0, 8)
const sourceId = `test-source-${suffix}`
const otherSourceId = `test-source-b-${suffix}`
const keyA = `https://example.invalid/${suffix}/a`
const keyB = `https://example.invalid/${suffix}/b`

afterAll(async () => {
  await db.deleteFrom("feedItem").where("itemKey", "in", [keyA, keyB]).execute()
  await db
    .deleteFrom("feedSourceState")
    .where("sourceId", "in", [sourceId, otherSourceId])
    .execute()
  await db.destroy()
})

describe("truncateTitle", () => {
  it("leaves a normal headline alone", () => {
    expect(truncateTitle("Coalition talks collapse")).toBe("Coalition talks collapse")
  })

  it("collapses stray whitespace", () => {
    expect(truncateTitle("  Two   spaces\nand a newline ")).toBe("Two spaces and a newline")
  })

  it("cuts an over-long headline at a word boundary and stays within the column limit", () => {
    const long = `${"alpha bravo ".repeat(40)}omega`
    const result = truncateTitle(long)
    expect(result.length).toBeLessThanOrEqual(300)
    expect(result.endsWith("…")).toBe(true)
    // The cut lands on a word boundary, so no partial word before the ellipsis.
    expect(result.slice(0, -1).endsWith(" ")).toBe(false)
    expect(long.startsWith(result.slice(0, -1))).toBe(true)
  })

  it("keeps a title of exactly the limit unchanged", () => {
    const exact = "x".repeat(300)
    expect(truncateTitle(exact)).toBe(exact)
  })
})

describe("feed_item dedupe", () => {
  it("lets the first source claim an item key", async () => {
    const claimed = await crudFeedItem(db).claim({ sourceId, itemKey: keyA })
    expect(claimed).toBeDefined()
    expect(claimed?.itemKey).toBe(keyA)
  })

  it("refuses a second claim on the same key, even from another source", async () => {
    // This is what stops a syndicated article being posted once per source that carries it.
    const again = await crudFeedItem(db).claim({ sourceId: otherSourceId, itemKey: keyA })
    expect(again).toBeUndefined()
  })

  it("reports existing keys so a run can filter in one query", async () => {
    const existing = await fetchFeedItem(db).existingItemKeys([keyA, keyB])
    expect(existing.has(keyA)).toBe(true)
    expect(existing.has(keyB)).toBe(false)
  })

  it("frees the key again when a claim is released", async () => {
    const claimed = await crudFeedItem(db).claim({ sourceId, itemKey: keyB })
    expect(claimed).toBeDefined()
    await crudFeedItem(db).deleteById(claimed!.id)
    const reclaimed = await crudFeedItem(db).claim({ sourceId, itemKey: keyB })
    expect(reclaimed).toBeDefined()
  })
})

describe("feed_source_state", () => {
  it("records a successful fetch with its conditional-GET validators", async () => {
    await crudFeedSourceState(db).markOk(sourceId, {
      etag: 'W/"abc"',
      lastModified: "Wed, 13 Aug 2026 09:00:00 GMT",
    })
    const state = await fetchFeedSourceState(db).getOne(sourceId, [
      "lastStatus",
      "etag",
      "lastModified",
      "lastError",
    ])
    expect(state?.lastStatus).toBe("ok")
    expect(state?.etag).toBe('W/"abc"')
    expect(state?.lastError).toBeNull()
  })

  it("keeps the validators when a later fetch fails", async () => {
    await crudFeedSourceState(db).markError(sourceId, "HTTP 503")
    const state = await fetchFeedSourceState(db).getOne(sourceId, [
      "lastStatus",
      "lastError",
      "etag",
    ])
    expect(state?.lastStatus).toBe("error")
    expect(state?.lastError).toBe("HTTP 503")
    // Losing the ETag on a transient failure would force a full refetch next run.
    expect(state?.etag).toBe('W/"abc"')
  })

  it("surfaces failing sources for monitoring", async () => {
    const failing = await fetchFeedSourceState(db).listFailing()
    expect(failing.some((s) => s.sourceId === sourceId)).toBe(true)
  })
})

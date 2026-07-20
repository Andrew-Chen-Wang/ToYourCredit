import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudPost } from "../post/crud"
import { crudPostVote } from "./crud"
import { fetchPostVote } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const voterId = v7()
const secondVoterId = v7()
const communityId = v7()
const postId = v7()
const selfPostId = v7()
const byIdPostId = v7()

async function authorKarma(): Promise<number> {
  const row = await db
    .selectFrom("user")
    .select("postKarma")
    .where("id", "=", authorId)
    .executeTakeFirstOrThrow()
  return row.postKarma
}

async function counts(): Promise<{ ups: number; downs: number }> {
  const row = await db
    .selectFrom("post")
    .select(["ups", "downs"])
    .where("id", "=", postId)
    .executeTakeFirstOrThrow()
  return { ups: row.ups, downs: row.downs }
}

async function reasonRows(userId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("postVoteReason")
    .select("category")
    .where("postId", "=", postId)
    .where("userId", "=", userId)
    .orderBy("category")
    .execute()
  return rows.map((r) => r.category)
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: authorId, username: `vote-author-${suffix}`, email: `va-${suffix}@example.invalid` },
      { id: voterId, username: `vote-voter-${suffix}`, email: `vv-${suffix}@example.invalid` },
      {
        id: secondVoterId,
        username: `vote-voter2-${suffix}`,
        email: `vw-${suffix}@example.invalid`,
      },
    ])
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `votetest${suffix}`,
      description: "vote test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()

  await db
    .insertInto("post")
    .values(
      [postId, selfPostId, byIdPostId].map((id) => ({
        id,
        authorUserId: authorId,
        communityId,
        type: "text" as const,
        title: "vote test post",
        ups: 0,
        downs: 0,
      })),
    )
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("post").where("id", "in", [postId, selfPostId, byIdPostId]).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [authorId, voterId, secondVoterId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("crudPostVote.setVote transitions", () => {
  it("none -> credit increments ups, score, and author karma", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, {
      type: "credit",
      active: true,
    })
    expect(result).toEqual({
      ups: 1,
      downs: 0,
      score: 1,
      userVote: 1,
      myDownvoteCategories: [],
    })
    expect(await counts()).toEqual({ ups: 1, downs: 0 })
    expect(await authorKarma()).toBe(1)
  })

  it("credit -> categorized downvote swings counts by two and stores reasons", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, {
      type: "down",
      categories: ["bad_source", "trolling"],
    })
    expect(result).toEqual({
      ups: 0,
      downs: 1,
      score: -1,
      userVote: -1,
      myDownvoteCategories: ["bad_source", "trolling"],
    })
    expect(await counts()).toEqual({ ups: 0, downs: 1 })
    expect(await authorKarma()).toBe(-1)
    expect(await reasonRows(voterId)).toEqual(["bad_source", "trolling"])
  })

  it("multiple categories from one user still count as a single downvote", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, {
      type: "down",
      categories: ["bad_source", "trolling", "inflammatory"],
    })
    expect(result?.downs).toBe(1)
    expect(await reasonRows(voterId)).toEqual(["bad_source", "inflammatory", "trolling"])
  })

  it("removing a category keeps the downvote; total unchanged", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, {
      type: "down",
      categories: ["trolling"],
    })
    expect(result?.downs).toBe(1)
    expect(result?.myDownvoteCategories).toEqual(["trolling"])
    expect(await reasonRows(voterId)).toEqual(["trolling"])
  })

  it("a second downvoter increments the distinct-user total", async () => {
    const result = await crudPostVote(db).setVote(postId, secondVoterId, {
      type: "down",
      categories: ["off_topic"],
    })
    expect(result?.downs).toBe(2)
    const summary = await fetchPostVote(db).getCategoryCounts(postId)
    expect(summary).toEqual({ trolling: 1, off_topic: 1 })
  })

  it("clearing credit does not cancel an active downvote", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, {
      type: "credit",
      active: false,
    })
    expect(result?.userVote).toBe(-1)
    expect(result?.downs).toBe(2)
    expect(await reasonRows(voterId)).toEqual(["trolling"])
  })

  it("downvote -> credit removes reason rows explicitly", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, {
      type: "credit",
      active: true,
    })
    expect(result?.userVote).toBe(1)
    expect(result?.ups).toBe(1)
    expect(result?.downs).toBe(1)
    expect(await reasonRows(voterId)).toEqual([])
  })

  it("empty category set clears the downvote and cascades reasons", async () => {
    const result = await crudPostVote(db).setVote(postId, secondVoterId, {
      type: "down",
      categories: [],
    })
    expect(result).toEqual({
      ups: 1,
      downs: 0,
      score: 1,
      userVote: 0,
      myDownvoteCategories: [],
    })
    expect(await reasonRows(secondVoterId)).toEqual([])
  })

  it("credit -> clear resets counts and karma", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, {
      type: "credit",
      active: false,
    })
    expect(result).toEqual({
      ups: 0,
      downs: 0,
      score: 0,
      userVote: 0,
      myDownvoteCategories: [],
    })
    expect(await counts()).toEqual({ ups: 0, downs: 0 })
    expect(await authorKarma()).toBe(0)

    const vote = await db
      .selectFrom("postVote")
      .select("value")
      .where("postId", "=", postId)
      .where("userId", "=", voterId)
      .executeTakeFirst()
    expect(vote).toBeUndefined()
  })

  it("voter lists expose upvoters and per-category downvoters", async () => {
    await crudPostVote(db).setVote(postId, voterId, { type: "credit", active: true })
    await crudPostVote(db).setVote(postId, secondVoterId, {
      type: "down",
      categories: ["bad_source"],
    })

    const upvoters = await fetchPostVote(db).listUpvoters(postId, 10)
    expect(upvoters.voters.map((v) => v.userId)).toEqual([voterId])

    const downvoters = await fetchPostVote(db).listDownvoters(postId, 10)
    expect(downvoters.voters.map((v) => v.userId)).toEqual([secondVoterId])

    const byCategory = await fetchPostVote(db).listDownvoters(postId, 10, "bad_source")
    expect(byCategory.voters.map((v) => v.userId)).toEqual([secondVoterId])

    const other = await fetchPostVote(db).listDownvoters(postId, 10, "trolling")
    expect(other.voters).toEqual([])
  })
})

describe.skipIf(process.env.CI === "true")("self-votes and delete credit", () => {
  it("author self-vote moves score but not credit", async () => {
    const baseline = await authorKarma()

    const up = await crudPostVote(db).setVote(selfPostId, authorId, {
      type: "credit",
      active: true,
    })
    expect(up?.ups).toBe(1)
    expect(await authorKarma()).toBe(baseline)

    const down = await crudPostVote(db).setVote(selfPostId, authorId, {
      type: "down",
      categories: ["trolling"],
    })
    expect(down?.downs).toBe(1)
    expect(await authorKarma()).toBe(baseline)

    const backUp = await crudPostVote(db).setVote(selfPostId, authorId, {
      type: "credit",
      active: true,
    })
    expect(backUp?.userVote).toBe(1)
    expect(await authorKarma()).toBe(baseline)
  })

  it("deleteOwn removes credit earned from others, ignoring the self-vote", async () => {
    const baseline = await authorKarma()
    await crudPostVote(db).setVote(selfPostId, voterId, { type: "credit", active: true })
    expect(await authorKarma()).toBe(baseline + 1)

    expect(await crudPost(db).deleteOwn(selfPostId, authorId)).toBe(true)
    expect(await authorKarma()).toBe(baseline)

    const gone = await db
      .selectFrom("post")
      .select("id")
      .where("id", "=", selfPostId)
      .executeTakeFirst()
    expect(gone).toBeUndefined()
  })

  it("deleteById removes credit earned from others", async () => {
    const baseline = await authorKarma()
    await crudPostVote(db).setVote(byIdPostId, voterId, {
      type: "down",
      categories: ["spam"],
    })
    expect(await authorKarma()).toBe(baseline - 1)

    expect(await crudPost(db).deleteById(byIdPostId)).toBe(true)
    expect(await authorKarma()).toBe(baseline)
  })
})

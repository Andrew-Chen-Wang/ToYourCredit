import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudCommentVote } from "./crud"
import { fetchCommentVote } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const voterId = v7()
const communityId = v7()
const postId = v7()
const commentId = v7()

async function authorKarma(): Promise<number> {
  const row = await db
    .selectFrom("user")
    .select("commentKarma")
    .where("id", "=", authorId)
    .executeTakeFirstOrThrow()
  return row.commentKarma
}

async function counts(): Promise<{ ups: number; downs: number; score: number }> {
  const row = await db
    .selectFrom("comment")
    .select(["ups", "downs", "score"])
    .where("id", "=", commentId)
    .executeTakeFirstOrThrow()
  return { ups: row.ups, downs: row.downs, score: row.score }
}

async function reasonRows(): Promise<string[]> {
  const rows = await db
    .selectFrom("commentVoteReason")
    .select("category")
    .where("commentId", "=", commentId)
    .where("userId", "=", voterId)
    .orderBy("category")
    .execute()
  return rows.map((r) => r.category)
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: authorId, username: `cvote-author-${suffix}`, email: `cva-${suffix}@example.invalid` },
      { id: voterId, username: `cvote-voter-${suffix}`, email: `cvv-${suffix}@example.invalid` },
    ])
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `cvotetest${suffix}`,
      description: "comment vote test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()

  await db
    .insertInto("post")
    .values({ id: postId, authorUserId: authorId, communityId, type: "text", title: "cv post" })
    .execute()

  await db
    .insertInto("comment")
    .values({
      id: commentId,
      postId,
      parentCommentId: null,
      path: [commentId],
      depth: 0,
      authorUserId: authorId,
      bodyMd: "vote target",
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("comment").where("postId", "=", postId).execute()
  await db.deleteFrom("post").where("id", "=", postId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [authorId, voterId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("crudCommentVote.setVote transitions", () => {
  it("none -> credit increments ups, score, and author comment karma", async () => {
    const result = await crudCommentVote(db).setVote(commentId, voterId, {
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
    expect(await counts()).toEqual({ ups: 1, downs: 0, score: 1 })
    expect(await authorKarma()).toBe(1)
  })

  it("credit -> categorized downvote swings counts and karma by two", async () => {
    const result = await crudCommentVote(db).setVote(commentId, voterId, {
      type: "down",
      categories: ["wont_accept_wrong", "unsupported_argument"],
    })
    expect(result).toEqual({
      ups: 0,
      downs: 1,
      score: -1,
      userVote: -1,
      myDownvoteCategories: ["wont_accept_wrong", "unsupported_argument"],
    })
    expect(await counts()).toEqual({ ups: 0, downs: 1, score: -1 })
    expect(await authorKarma()).toBe(-1)
    expect(await reasonRows()).toEqual(["unsupported_argument", "wont_accept_wrong"])

    const summary = await fetchCommentVote(db).getCategoryCounts(commentId)
    expect(summary).toEqual({ unsupported_argument: 1, wont_accept_wrong: 1 })
    const downvoters = await fetchCommentVote(db).listDownvoters(commentId, 10)
    expect(downvoters.voters.map((v) => v.userId)).toEqual([voterId])
  })

  it("downvote -> clear resets counts, karma, and removes vote + reason rows", async () => {
    const result = await crudCommentVote(db).setVote(commentId, voterId, {
      type: "down",
      categories: [],
    })
    expect(result).toEqual({
      ups: 0,
      downs: 0,
      score: 0,
      userVote: 0,
      myDownvoteCategories: [],
    })
    expect(await counts()).toEqual({ ups: 0, downs: 0, score: 0 })
    expect(await authorKarma()).toBe(0)

    const vote = await db
      .selectFrom("commentVote")
      .select("value")
      .where("commentId", "=", commentId)
      .where("userId", "=", voterId)
      .executeTakeFirst()
    expect(vote).toBeUndefined()
    expect(await reasonRows()).toEqual([])
  })
})

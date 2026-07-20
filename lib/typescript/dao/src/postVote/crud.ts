import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import type { DownvoteCategory } from "../vote/categories"

export interface SetVoteResult {
  ups: number
  downs: number
  score: number
  userVote: number
  myDownvoteCategories: string[]
}

export type SetVoteInput =
  | { type: "credit"; active: boolean }
  | { type: "down"; categories: DownvoteCategory[] }

export function crudPostVote(db: Kysely<DB>) {
  async function setVote(
    postId: string,
    userId: string,
    input: SetVoteInput,
  ): Promise<SetVoteResult | undefined> {
    const categories = input.type === "down" ? [...new Set(input.categories)] : []
    const newValue =
      input.type === "credit" ? (input.active ? 1 : 0) : categories.length > 0 ? -1 : 0

    return await db.transaction().execute(async (trx) => {
      const post = await trx
        .selectFrom("post")
        .select(["authorUserId"])
        .where("id", "=", postId)
        .executeTakeFirst()
      if (!post) return undefined

      const existing = await trx
        .selectFrom("postVote")
        .select(["value"])
        .where("postId", "=", postId)
        .where("userId", "=", userId)
        .executeTakeFirst()

      const oldValue = existing?.value ?? 0

      // Clearing one direction never cancels a vote in the other direction.
      if (newValue === 0 && oldValue !== 0 && oldValue !== (input.type === "credit" ? 1 : -1)) {
        const counts = await trx
          .selectFrom("post")
          .select(["ups", "downs"])
          .where("id", "=", postId)
          .executeTakeFirstOrThrow()
        const reasons =
          oldValue === -1
            ? await trx
                .selectFrom("postVoteReason")
                .select("category")
                .where("postId", "=", postId)
                .where("userId", "=", userId)
                .execute()
            : []
        return {
          ups: counts.ups,
          downs: counts.downs,
          score: counts.ups - counts.downs,
          userVote: oldValue,
          myDownvoteCategories: reasons.map((r) => r.category),
        }
      }

      if (newValue === 0) {
        if (existing) {
          await trx
            .deleteFrom("postVote")
            .where("postId", "=", postId)
            .where("userId", "=", userId)
            .execute()
        }
      } else if (existing) {
        await trx
          .updateTable("postVote")
          .set({ value: newValue, updatedAt: new Date() })
          .where("postId", "=", postId)
          .where("userId", "=", userId)
          .execute()
      } else {
        await trx.insertInto("postVote").values({ postId, userId, value: newValue }).execute()
      }

      // Reason rows: the vote-row DELETE cascades, but the -1 -> 1 path is an
      // UPDATE, so stale reasons must be removed explicitly.
      if (newValue === -1) {
        await trx
          .deleteFrom("postVoteReason")
          .where("postId", "=", postId)
          .where("userId", "=", userId)
          .where("category", "not in", categories)
          .execute()
        await trx
          .insertInto("postVoteReason")
          .values(categories.map((category) => ({ postId, userId, category })))
          .onConflict((oc) => oc.doNothing())
          .execute()
      } else if (oldValue === -1) {
        await trx
          .deleteFrom("postVoteReason")
          .where("postId", "=", postId)
          .where("userId", "=", userId)
          .execute()
      }

      const upDelta = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0)
      const downDelta = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0)
      const scoreDelta = upDelta - downDelta

      const counts = await trx
        .updateTable("post")
        .set((eb) => ({
          ups: eb("ups", "+", upDelta),
          downs: eb("downs", "+", downDelta),
        }))
        .where("id", "=", postId)
        .returning(["ups", "downs"])
        .executeTakeFirstOrThrow()

      // Self-votes (including the auto-upvote on create) affect the post's
      // score but never the author's credit.
      if (scoreDelta !== 0 && post.authorUserId !== userId) {
        await trx
          .updateTable("user")
          .set((eb) => ({ postKarma: eb("postKarma", "+", scoreDelta) }))
          .where("id", "=", post.authorUserId)
          .execute()
      }

      return {
        ups: counts.ups,
        downs: counts.downs,
        score: counts.ups - counts.downs,
        userVote: newValue,
        myDownvoteCategories: newValue === -1 ? categories : [],
      }
    })
  }

  return { setVote }
}

import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import type { DownvoteCategory } from "../vote/categories"

export interface SetCommentVoteResult {
  ups: number
  downs: number
  score: number
  userVote: number
  myDownvoteCategories: string[]
}

export type SetCommentVoteInput =
  | { type: "credit"; active: boolean }
  | { type: "down"; categories: DownvoteCategory[] }

export function crudCommentVote(db: Kysely<DB>) {
  async function setVote(
    commentId: string,
    userId: string,
    input: SetCommentVoteInput,
  ): Promise<SetCommentVoteResult | undefined> {
    const categories = input.type === "down" ? [...new Set(input.categories)] : []
    const newValue =
      input.type === "credit" ? (input.active ? 1 : 0) : categories.length > 0 ? -1 : 0

    return await db.transaction().execute(async (trx) => {
      const comment = await trx
        .selectFrom("comment")
        .select(["authorUserId"])
        .where("id", "=", commentId)
        .executeTakeFirst()
      if (!comment) return undefined

      const existing = await trx
        .selectFrom("commentVote")
        .select(["value"])
        .where("commentId", "=", commentId)
        .where("userId", "=", userId)
        .executeTakeFirst()

      const oldValue = existing?.value ?? 0

      // Clearing one direction never cancels a vote in the other direction.
      if (newValue === 0 && oldValue !== 0 && oldValue !== (input.type === "credit" ? 1 : -1)) {
        const counts = await trx
          .selectFrom("comment")
          .select(["ups", "downs"])
          .where("id", "=", commentId)
          .executeTakeFirstOrThrow()
        const reasons =
          oldValue === -1
            ? await trx
                .selectFrom("commentVoteReason")
                .select("category")
                .where("commentId", "=", commentId)
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
            .deleteFrom("commentVote")
            .where("commentId", "=", commentId)
            .where("userId", "=", userId)
            .execute()
        }
      } else if (existing) {
        await trx
          .updateTable("commentVote")
          .set({ value: newValue, updatedAt: new Date() })
          .where("commentId", "=", commentId)
          .where("userId", "=", userId)
          .execute()
      } else {
        await trx.insertInto("commentVote").values({ commentId, userId, value: newValue }).execute()
      }

      // Reason rows: the vote-row DELETE cascades, but the -1 -> 1 path is an
      // UPDATE, so stale reasons must be removed explicitly.
      if (newValue === -1) {
        await trx
          .deleteFrom("commentVoteReason")
          .where("commentId", "=", commentId)
          .where("userId", "=", userId)
          .where("category", "not in", categories)
          .execute()
        await trx
          .insertInto("commentVoteReason")
          .values(categories.map((category) => ({ commentId, userId, category })))
          .onConflict((oc) => oc.doNothing())
          .execute()
      } else if (oldValue === -1) {
        await trx
          .deleteFrom("commentVoteReason")
          .where("commentId", "=", commentId)
          .where("userId", "=", userId)
          .execute()
      }

      const upDelta = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0)
      const downDelta = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0)
      const scoreDelta = upDelta - downDelta

      const counts = await trx
        .updateTable("comment")
        .set((eb) => ({
          ups: eb("ups", "+", upDelta),
          downs: eb("downs", "+", downDelta),
        }))
        .where("id", "=", commentId)
        .returning(["ups", "downs"])
        .executeTakeFirstOrThrow()

      if (scoreDelta !== 0 && comment.authorUserId) {
        await trx
          .updateTable("user")
          .set((eb) => ({ commentKarma: eb("commentKarma", "+", scoreDelta) }))
          .where("id", "=", comment.authorUserId)
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

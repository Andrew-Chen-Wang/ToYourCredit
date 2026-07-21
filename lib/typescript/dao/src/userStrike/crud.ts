import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"

export function crudUserStrike(db: Kysely<DB>) {
  async function issue(data: {
    userId: string
    issuedByUserId: string
    reason: string
    postId?: string | null
    commentId?: string | null
  }): Promise<Selectable<DB["userStrike"]>> {
    return await db
      .insertInto("userStrike")
      .values({
        id: v7(),
        userId: data.userId,
        issuedByUserId: data.issuedByUserId,
        reason: data.reason,
        postId: data.postId ?? null,
        commentId: data.commentId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function revoke(id: string, revokedByUserId: string): Promise<boolean> {
    const result = await db
      .updateTable("userStrike")
      .set({ revokedAt: new Date(), revokedByUserId })
      .where("id", "=", id)
      .where("revokedAt", "is", null)
      .executeTakeFirst()
    return result.numUpdatedRows > 0n
  }

  return { issue, revoke }
}

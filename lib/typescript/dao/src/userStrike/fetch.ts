import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export const STRIKE_WINDOW_DAYS = 365

export function strikeWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - STRIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

export function fetchUserStrike(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["userStrike"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["userStrike"]>, T[number]> | undefined> {
    return await db.selectFrom("userStrike").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function countActive(userId: string): Promise<number> {
    const row = await db
      .selectFrom("userStrike")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("userId", "=", userId)
      .where("revokedAt", "is", null)
      .where("createdAt", ">", strikeWindowStart())
      .executeTakeFirst()
    return Number(row?.count ?? 0)
  }

  async function listForUser<T extends (keyof DB["userStrike"])[]>(
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["userStrike"]>, T[number]>[]> {
    return await db
      .selectFrom("userStrike")
      .select(fields)
      .where("userId", "=", userId)
      .where("revokedAt", "is", null)
      .orderBy("createdAt", "desc")
      .execute()
  }

  async function listForUserAdmin(userId: string) {
    return await db
      .selectFrom("userStrike")
      .leftJoin("user as issuer", "issuer.id", "userStrike.issuedByUserId")
      .leftJoin("user as revoker", "revoker.id", "userStrike.revokedByUserId")
      .where("userStrike.userId", "=", userId)
      .select([
        "userStrike.id as id",
        "userStrike.reason as reason",
        "userStrike.postId as postId",
        "userStrike.commentId as commentId",
        "userStrike.createdAt as createdAt",
        "userStrike.revokedAt as revokedAt",
        "issuer.username as issuedByUsername",
        "revoker.username as revokedByUsername",
      ])
      .orderBy("userStrike.createdAt", "desc")
      .execute()
  }

  async function listForUserPublic(userId: string, cursorId: string | null, limit: number) {
    let query = db
      .selectFrom("userStrike")
      .leftJoin("post", "post.id", "userStrike.postId")
      .leftJoin("community as postCommunity", "postCommunity.id", "post.communityId")
      .leftJoin("comment", "comment.id", "userStrike.commentId")
      .leftJoin("post as commentPost", "commentPost.id", "comment.postId")
      .leftJoin("community as commentCommunity", "commentCommunity.id", "commentPost.communityId")
      .where("userStrike.userId", "=", userId)
      .where("userStrike.revokedAt", "is", null)
      .select([
        "userStrike.id as id",
        "userStrike.reason as reason",
        "userStrike.postId as postId",
        "userStrike.commentId as commentId",
        "userStrike.createdAt as createdAt",
        "post.title as postTitle",
        "post.bodyMd as postBodyMd",
        "post.removedAt as postRemovedAt",
        "post.communityId as postCommunityId",
        "postCommunity.name as postCommunityName",
        "postCommunity.visibility as postCommunityVisibility",
        "comment.bodyMd as commentBodyMd",
        "comment.postId as commentPostId",
        "comment.removedAt as commentRemovedAt",
        "commentPost.title as commentPostTitle",
        "commentPost.communityId as commentCommunityId",
        "commentCommunity.name as commentCommunityName",
        "commentCommunity.visibility as commentCommunityVisibility",
      ])
      .orderBy("userStrike.id", "desc")
      .limit(limit)
    if (cursorId) query = query.where("userStrike.id", "<", cursorId)
    return await query.execute()
  }

  async function hasActiveForContent(
    ref: { postId: string } | { commentId: string },
  ): Promise<boolean> {
    let query = db.selectFrom("userStrike").select("id").where("revokedAt", "is", null)
    query =
      "postId" in ref
        ? query.where("postId", "=", ref.postId)
        : query.where("commentId", "=", ref.commentId)
    const row = await query.executeTakeFirst()
    return row !== undefined
  }

  return {
    getOne,
    countActive,
    listForUser,
    listForUserAdmin,
    listForUserPublic,
    hasActiveForContent,
  }
}

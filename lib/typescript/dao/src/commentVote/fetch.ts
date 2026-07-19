import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import type { VoterListItem, VoterPage } from "../postVote/fetch"

function encodeCursor(item: VoterListItem): string {
  return `${item.votedAt.toISOString()}_${item.userId}`
}

function decodeCursor(cursor: string): { votedAt: Date; userId: string } | null {
  const sep = cursor.lastIndexOf("_")
  if (sep === -1) return null
  const votedAt = new Date(cursor.slice(0, sep))
  if (Number.isNaN(votedAt.getTime())) return null
  return { votedAt, userId: cursor.slice(sep + 1) }
}

export function fetchCommentVote(db: Kysely<DB>) {
  async function listUpvoters(
    commentId: string,
    limit: number,
    cursor?: string,
  ): Promise<VoterPage> {
    let query = db
      .selectFrom("commentVote")
      .innerJoin("user", "user.id", "commentVote.userId")
      .select([
        "commentVote.userId",
        "user.username",
        "user.displayName",
        "user.avatarImageKey",
        "commentVote.createdAt as votedAt",
      ])
      .where("commentVote.commentId", "=", commentId)
      .where("commentVote.value", "=", 1)
      .orderBy("commentVote.createdAt", "desc")
      .orderBy("commentVote.userId", "desc")
      .limit(limit + 1)

    const decoded = cursor ? decodeCursor(cursor) : null
    if (decoded) {
      query = query.where((eb) =>
        eb.or([
          eb("commentVote.createdAt", "<", decoded.votedAt),
          eb.and([
            eb("commentVote.createdAt", "=", decoded.votedAt),
            eb("commentVote.userId", "<", decoded.userId),
          ]),
        ]),
      )
    }

    const rows = await query.execute()
    const voters = rows.slice(0, limit)
    return {
      voters,
      nextCursor: rows.length > limit ? encodeCursor(voters[voters.length - 1]) : null,
    }
  }

  async function listDownvoters(
    commentId: string,
    limit: number,
    category?: string,
    cursor?: string,
  ): Promise<VoterPage> {
    if (!category) {
      // comment_vote already holds exactly one row per downvoting user.
      let query = db
        .selectFrom("commentVote")
        .innerJoin("user", "user.id", "commentVote.userId")
        .select([
          "commentVote.userId",
          "user.username",
          "user.displayName",
          "user.avatarImageKey",
          "commentVote.createdAt as votedAt",
        ])
        .where("commentVote.commentId", "=", commentId)
        .where("commentVote.value", "=", -1)
        .orderBy("commentVote.createdAt", "desc")
        .orderBy("commentVote.userId", "desc")
        .limit(limit + 1)

      const decodedAll = cursor ? decodeCursor(cursor) : null
      if (decodedAll) {
        query = query.where((eb) =>
          eb.or([
            eb("commentVote.createdAt", "<", decodedAll.votedAt),
            eb.and([
              eb("commentVote.createdAt", "=", decodedAll.votedAt),
              eb("commentVote.userId", "<", decodedAll.userId),
            ]),
          ]),
        )
      }
      const rows = await query.execute()
      const voters = rows.slice(0, limit)
      return {
        voters,
        nextCursor: rows.length > limit ? encodeCursor(voters[voters.length - 1]) : null,
      }
    }

    let query = db
      .selectFrom("commentVoteReason")
      .innerJoin("user", "user.id", "commentVoteReason.userId")
      .select([
        "commentVoteReason.userId",
        "user.username",
        "user.displayName",
        "user.avatarImageKey",
        "commentVoteReason.createdAt as votedAt",
      ])
      .where("commentVoteReason.commentId", "=", commentId)
      .where("commentVoteReason.category", "=", category)
      .orderBy("commentVoteReason.createdAt", "desc")
      .orderBy("commentVoteReason.userId", "desc")
      .limit(limit + 1)

    const decoded = cursor ? decodeCursor(cursor) : null
    if (decoded) {
      query = query.where((eb) =>
        eb.or([
          eb("commentVoteReason.createdAt", "<", decoded.votedAt),
          eb.and([
            eb("commentVoteReason.createdAt", "=", decoded.votedAt),
            eb("commentVoteReason.userId", "<", decoded.userId),
          ]),
        ]),
      )
    }

    const rows = await query.execute()
    const voters = rows.slice(0, limit)
    return {
      voters,
      nextCursor: rows.length > limit ? encodeCursor(voters[voters.length - 1]) : null,
    }
  }

  async function getCategoryCounts(commentId: string): Promise<Record<string, number>> {
    const rows = await db
      .selectFrom("commentVoteReason")
      .select((eb) => ["category", eb.fn.count<string>("userId").as("count")])
      .where("commentId", "=", commentId)
      .groupBy("category")
      .execute()
    return Object.fromEntries(rows.map((row) => [row.category, Number(row.count)]))
  }

  async function getMyCategories(commentId: string, userId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("commentVoteReason")
      .select("category")
      .where("commentId", "=", commentId)
      .where("userId", "=", userId)
      .execute()
    return rows.map((row) => row.category)
  }

  return { listUpvoters, listDownvoters, getCategoryCounts, getMyCategories }
}

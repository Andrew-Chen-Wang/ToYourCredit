import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface VoterListItem {
  userId: string
  username: string
  displayName: string | null
  avatarImageKey: string | null
  votedAt: Date
}

export interface VoterPage {
  voters: VoterListItem[]
  nextCursor: string | null
}

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

export function fetchPostVote(db: Kysely<DB>) {
  async function listUpvoters(postId: string, limit: number, cursor?: string): Promise<VoterPage> {
    let query = db
      .selectFrom("postVote")
      .innerJoin("user", "user.id", "postVote.userId")
      .select([
        "postVote.userId",
        "user.username",
        "user.displayName",
        "user.avatarImageKey",
        "postVote.createdAt as votedAt",
      ])
      .where("postVote.postId", "=", postId)
      .where("postVote.value", "=", 1)
      .orderBy("postVote.createdAt", "desc")
      .orderBy("postVote.userId", "desc")
      .limit(limit + 1)

    const decoded = cursor ? decodeCursor(cursor) : null
    if (decoded) {
      query = query.where((eb) =>
        eb.or([
          eb("postVote.createdAt", "<", decoded.votedAt),
          eb.and([
            eb("postVote.createdAt", "=", decoded.votedAt),
            eb("postVote.userId", "<", decoded.userId),
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
    postId: string,
    limit: number,
    category?: string,
    cursor?: string,
  ): Promise<VoterPage> {
    if (!category) {
      // post_vote already holds exactly one row per downvoting user.
      let query = db
        .selectFrom("postVote")
        .innerJoin("user", "user.id", "postVote.userId")
        .select([
          "postVote.userId",
          "user.username",
          "user.displayName",
          "user.avatarImageKey",
          "postVote.createdAt as votedAt",
        ])
        .where("postVote.postId", "=", postId)
        .where("postVote.value", "=", -1)
        .orderBy("postVote.createdAt", "desc")
        .orderBy("postVote.userId", "desc")
        .limit(limit + 1)

      const decodedAll = cursor ? decodeCursor(cursor) : null
      if (decodedAll) {
        query = query.where((eb) =>
          eb.or([
            eb("postVote.createdAt", "<", decodedAll.votedAt),
            eb.and([
              eb("postVote.createdAt", "=", decodedAll.votedAt),
              eb("postVote.userId", "<", decodedAll.userId),
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
      .selectFrom("postVoteReason")
      .innerJoin("user", "user.id", "postVoteReason.userId")
      .select([
        "postVoteReason.userId",
        "user.username",
        "user.displayName",
        "user.avatarImageKey",
        "postVoteReason.createdAt as votedAt",
      ])
      .where("postVoteReason.postId", "=", postId)
      .where("postVoteReason.category", "=", category)
      .orderBy("postVoteReason.createdAt", "desc")
      .orderBy("postVoteReason.userId", "desc")
      .limit(limit + 1)

    const decoded = cursor ? decodeCursor(cursor) : null
    if (decoded) {
      query = query.where((eb) =>
        eb.or([
          eb("postVoteReason.createdAt", "<", decoded.votedAt),
          eb.and([
            eb("postVoteReason.createdAt", "=", decoded.votedAt),
            eb("postVoteReason.userId", "<", decoded.userId),
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

  async function getCategoryCounts(postId: string): Promise<Record<string, number>> {
    const rows = await db
      .selectFrom("postVoteReason")
      .select((eb) => ["category", eb.fn.count<string>("userId").as("count")])
      .where("postId", "=", postId)
      .groupBy("category")
      .execute()
    return Object.fromEntries(rows.map((row) => [row.category, Number(row.count)]))
  }

  async function getMyCategories(postId: string, userId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("postVoteReason")
      .select("category")
      .where("postId", "=", postId)
      .where("userId", "=", userId)
      .execute()
    return rows.map((row) => row.category)
  }

  return { listUpvoters, listDownvoters, getCategoryCounts, getMyCategories }
}

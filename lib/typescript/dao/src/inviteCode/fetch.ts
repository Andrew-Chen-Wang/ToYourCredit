import type { DB } from "@template-nextjs/db"
import { type Kysely, sql } from "kysely"

export interface InviteCodeWithReferral {
  id: string
  code: string
  createdAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  referral: {
    userId: string
    username: string
    displayName: string | null
    avatarImageKey: string | null
    nickname: string
  } | null
}

export function fetchInviteCode(db: Kysely<DB>) {
  async function listByCreator(userId: string): Promise<InviteCodeWithReferral[]> {
    const rows = await db
      .selectFrom("inviteCode")
      .leftJoin("user", "user.id", "inviteCode.usedByUserId")
      .select([
        "inviteCode.id",
        "inviteCode.code",
        "inviteCode.createdAt",
        "inviteCode.usedAt",
        "inviteCode.revokedAt",
        "inviteCode.usedByUserId",
        "inviteCode.referralNickname",
        "user.username",
        "user.displayName",
        "user.avatarImageKey",
        sql<string | null>`
          CASE WHEN invite_code.used_by_user_id IS NOT NULL THEN
            row_number() OVER (
              PARTITION BY invite_code.created_by_user_id, (invite_code.used_by_user_id IS NOT NULL)
              ORDER BY invite_code.used_at
            )::text
          END
        `.as("referralNumber"),
      ])
      .where("inviteCode.createdByUserId", "=", userId)
      .orderBy("inviteCode.createdAt", "desc")
      .execute()

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      createdAt: row.createdAt,
      usedAt: row.usedAt,
      revokedAt: row.revokedAt,
      referral:
        row.usedByUserId && row.username
          ? {
              userId: row.usedByUserId,
              username: row.username,
              displayName: row.displayName,
              avatarImageKey: row.avatarImageKey,
              nickname: row.referralNickname ?? `Referral ${row.referralNumber}`,
            }
          : null,
    }))
  }

  async function countByCreator(userId: string): Promise<{ active: number; total: number }> {
    const counts = await db
      .selectFrom("inviteCode")
      .select((eb) => [
        eb.fn.countAll<string>().as("total"),
        eb.fn
          .count<string>(
            eb
              .case()
              .when(eb.and([eb("usedByUserId", "is", null), eb("revokedAt", "is", null)]))
              .then(1)
              .end(),
          )
          .as("active"),
      ])
      .where("createdByUserId", "=", userId)
      .executeTakeFirstOrThrow()
    return { active: Number(counts.active), total: Number(counts.total) }
  }

  return { listByCreator, countByCreator }
}

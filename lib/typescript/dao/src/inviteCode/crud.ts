import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v4, v7 } from "uuid"

export const MAX_ACTIVE_INVITE_CODES = 3
export const MAX_TOTAL_INVITE_CODES = 9

export type CreateInviteCodeError = "ACTIVE_LIMIT_REACHED" | "TOTAL_LIMIT_REACHED"

export type CreateInviteCodeResult =
  | { ok: true; inviteCode: Selectable<DB["inviteCode"]> }
  | { ok: false; reason: CreateInviteCodeError }

// Unambiguous base32 (no 0/O/1/I), grouped for readability: XXXX-XXXX-XXXX.
// Randomness comes from uuid v4 (crypto-strong), avoiding a node:crypto import
// this package's tsconfig cannot resolve.
function generateCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
  const hex = (v4() + v4()).replaceAll("-", "")
  let chars = ""
  for (let i = 0; i < 12; i++) {
    chars += alphabet[Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16) % alphabet.length]
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`
}

export function crudInviteCode(db: Kysely<DB>) {
  async function createInviteCode(userId: string): Promise<CreateInviteCodeResult> {
    return await db.transaction().execute(async (trx) => {
      // Row lock serializes concurrent creations by the same user so the
      // count-then-insert below cannot race past the limits.
      await trx.selectFrom("user").select("id").where("id", "=", userId).forUpdate().execute()

      const counts = await trx
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

      if (Number(counts.total) >= MAX_TOTAL_INVITE_CODES) {
        return { ok: false, reason: "TOTAL_LIMIT_REACHED" }
      }
      if (Number(counts.active) >= MAX_ACTIVE_INVITE_CODES) {
        return { ok: false, reason: "ACTIVE_LIMIT_REACHED" }
      }

      const inviteCode = await trx
        .insertInto("inviteCode")
        .values({ id: v7(), code: generateCode(), createdByUserId: userId })
        .returningAll()
        .executeTakeFirstOrThrow()
      return { ok: true, inviteCode }
    })
  }

  async function consumeCode(code: string, byUserId: string): Promise<string | undefined> {
    // Single guarded UPDATE: exactly one caller can win a given code, and the
    // partial unique index on used_by_user_id blocks a user consuming twice.
    const row = await db
      .updateTable("inviteCode")
      .set({ usedByUserId: byUserId, usedAt: new Date() })
      .where("code", "=", code)
      .where("usedByUserId", "is", null)
      .where("revokedAt", "is", null)
      .returning("id")
      .executeTakeFirst()
    return row?.id
  }

  async function revoke(id: string, ownerUserId: string): Promise<boolean> {
    const result = await db
      .updateTable("inviteCode")
      .set({ revokedAt: new Date() })
      .where("id", "=", id)
      .where("createdByUserId", "=", ownerUserId)
      .where("usedByUserId", "is", null)
      .where("revokedAt", "is", null)
      .returning("id")
      .executeTakeFirst()
    return result !== undefined
  }

  async function setNickname(id: string, ownerUserId: string, nickname: string): Promise<boolean> {
    const result = await db
      .updateTable("inviteCode")
      .set({ referralNickname: nickname })
      .where("id", "=", id)
      .where("createdByUserId", "=", ownerUserId)
      .where("usedByUserId", "is not", null)
      .returning("id")
      .executeTakeFirst()
    return result !== undefined
  }

  return { createInviteCode, consumeCode, revoke, setNickname }
}

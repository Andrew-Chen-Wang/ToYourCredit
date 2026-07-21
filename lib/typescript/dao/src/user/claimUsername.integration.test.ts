import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudUser } from "./crud"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const claimantId = v7()
const holderId = v7()

async function usernameState(userId: string): Promise<{
  username: string
  usernameChangedAt: Date | null
}> {
  return await db
    .selectFrom("user")
    .select(["username", "usernameChangedAt"])
    .where("id", "=", userId)
    .executeTakeFirstOrThrow()
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      {
        id: claimantId,
        username: `claimant-${suffix}`,
        email: `claimant-${suffix}@example.invalid`,
      },
      {
        id: holderId,
        username: `taken-${suffix}`,
        email: `holder-${suffix}@example.invalid`,
      },
    ])
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("user").where("id", "in", [claimantId, holderId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("claimUsername during onboarding", () => {
  it("claims a free username without consuming the one-time change", async () => {
    const result = await crudUser(db).claimUsername(claimantId, `claimed-${suffix}`)
    expect(result).toEqual({ ok: true, username: `claimed-${suffix}` })
    const state = await usernameState(claimantId)
    expect(state.username).toBe(`claimed-${suffix}`)
    expect(state.usernameChangedAt).toBeNull()
  })

  it("rejects a case-variant of a name held by an unapproved user", async () => {
    const result = await crudUser(db).claimUsername(claimantId, `TAKEN-${suffix}`)
    expect(result).toEqual({ ok: false, reason: "TAKEN" })
    expect((await usernameState(claimantId)).username).toBe(`claimed-${suffix}`)
  })

  it("allows repeated claims while onboarding", async () => {
    const result = await crudUser(db).claimUsername(claimantId, `reclaimed-${suffix}`)
    expect(result).toEqual({ ok: true, username: `reclaimed-${suffix}` })
    expect((await usernameState(claimantId)).usernameChangedAt).toBeNull()
  })

  it("re-claiming your own current name is a no-op success", async () => {
    const result = await crudUser(db).claimUsername(claimantId, `reclaimed-${suffix}`)
    expect(result).toEqual({ ok: true, username: `reclaimed-${suffix}` })
  })

  it("leaves the one-time change available, which then locks as usual", async () => {
    const changed = await crudUser(db).changeUsername(claimantId, `changed-${suffix}`)
    expect(changed).toEqual({ ok: true, username: `changed-${suffix}` })
    expect((await usernameState(claimantId)).usernameChangedAt).not.toBeNull()

    const again = await crudUser(db).changeUsername(claimantId, `changed2-${suffix}`)
    expect(again).toEqual({ ok: false, reason: "ALREADY_CHANGED" })
  })

  it("returns NOT_FOUND for a nonexistent user", async () => {
    const result = await crudUser(db).claimUsername(v7(), `ghost-${suffix}`)
    expect(result).toEqual({ ok: false, reason: "NOT_FOUND" })
  })
})

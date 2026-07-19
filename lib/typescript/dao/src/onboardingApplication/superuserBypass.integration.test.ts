import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudInviteCode } from "../inviteCode/crud"
import { fetchInviteCode } from "../inviteCode/fetch"
import { crudOnboardingApplication } from "./crud"
import { fetchOnboardingApplication } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const adminId = v7()
const redeemerId = v7()
const normalUserId = v7()

const LINKS = {
  profileLink: "https://reddit.com/user/su-test",
  opinionLink: "https://reddit.com/r/policy/comments/1/a",
  criticalThinkingLink: "https://reddit.com/r/policy/comments/2/b",
  acceptWrongLink: "https://reddit.com/r/policy/comments/3/c",
}

async function verificationStatus(userId: string): Promise<string> {
  const row = await db
    .selectFrom("user")
    .select("verificationStatus")
    .where("id", "=", userId)
    .executeTakeFirstOrThrow()
  return row.verificationStatus
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      {
        id: adminId,
        username: `su-admin-${suffix}`,
        email: `sua-${suffix}@example.invalid`,
        isAdmin: true,
        verificationStatus: "verified",
      },
      {
        id: redeemerId,
        username: `su-redeemer-${suffix}`,
        email: `sur-${suffix}@example.invalid`,
      },
      {
        id: normalUserId,
        username: `su-normal-${suffix}`,
        email: `sun-${suffix}@example.invalid`,
      },
    ])
    .execute()
})

afterAll(async () => {
  await db
    .deleteFrom("onboardingApplication")
    .where("userId", "in", [redeemerId, normalUserId])
    .execute()
  await db.deleteFrom("inviteCode").where("createdByUserId", "=", adminId).execute()
  await db.deleteFrom("user").where("id", "in", [adminId, redeemerId, normalUserId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("superuser bypass invite codes", () => {
  it("superuser codes bypass the personal caps and the referral list", async () => {
    for (let i = 0; i < 5; i++) {
      await crudInviteCode(db).createSuperuserCode(adminId)
    }
    expect(await fetchInviteCode(db).countByCreator(adminId)).toEqual({ active: 0, total: 0 })
    expect(await fetchInviteCode(db).listByCreator(adminId)).toEqual([])
    expect((await fetchInviteCode(db).listSuperuserCodes()).length).toBeGreaterThanOrEqual(5)
  })

  it("getByCode reports superuser status without consuming", async () => {
    const created = await crudInviteCode(db).createSuperuserCode(adminId)
    const check = await fetchInviteCode(db).getByCode(created.code)
    expect(check).toEqual({ id: created.id, isSuperuser: true, active: true })
    // Still redeemable afterwards.
    expect((await fetchInviteCode(db).getByCode(created.code))?.active).toBe(true)
  })

  it("redeeming a superuser code auto-verifies with no application row", async () => {
    const created = await crudInviteCode(db).createSuperuserCode(adminId)
    const result = await crudOnboardingApplication(db).submit(redeemerId, created.code, null)
    expect(result).toEqual({ ok: true, superuser: true })
    expect(await verificationStatus(redeemerId)).toBe("verified")
    expect(await fetchOnboardingApplication(db).getByUserId(redeemerId)).toBeUndefined()
    // Code is consumed.
    expect((await fetchInviteCode(db).getByCode(created.code))?.active).toBe(false)
  })

  it("a normal code without links fails and rolls back the consumption", async () => {
    const created = await crudInviteCode(db).createInviteCode(adminId)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const missing = await crudOnboardingApplication(db).submit(
      normalUserId,
      created.inviteCode.code,
      null,
    )
    expect(missing).toEqual({ ok: false, reason: "LINKS_REQUIRED" })
    expect(await verificationStatus(normalUserId)).toBe("unverified")
    // The failed attempt must not burn the code.
    expect((await fetchInviteCode(db).getByCode(created.inviteCode.code))?.active).toBe(true)

    const withLinks = await crudOnboardingApplication(db).submit(
      normalUserId,
      created.inviteCode.code,
      LINKS,
    )
    expect(withLinks.ok).toBe(true)
    expect(await verificationStatus(normalUserId)).toBe("pending")
  })
})

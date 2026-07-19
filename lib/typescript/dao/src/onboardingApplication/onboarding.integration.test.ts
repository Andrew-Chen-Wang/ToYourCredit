import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudInviteCode, MAX_ACTIVE_INVITE_CODES } from "../inviteCode/crud"
import { fetchInviteCode } from "../inviteCode/fetch"
import { crudOnboardingApplication } from "./crud"
import { fetchOnboardingApplication } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const inviterId = v7()
const applicantId = v7()
const otherApplicantId = v7()
const adminId = v7()

const LINKS = {
  profileLink: "https://reddit.com/user/example",
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
        id: inviterId,
        username: `inviter-${suffix}`,
        email: `inv-${suffix}@example.invalid`,
        verificationStatus: "verified",
      },
      {
        id: applicantId,
        username: `applicant-${suffix}`,
        email: `app-${suffix}@example.invalid`,
      },
      {
        id: otherApplicantId,
        username: `applicant2-${suffix}`,
        email: `app2-${suffix}@example.invalid`,
      },
      {
        id: adminId,
        username: `admin-${suffix}`,
        email: `adm-${suffix}@example.invalid`,
        isAdmin: true,
        verificationStatus: "verified",
      },
    ])
    .execute()
})

afterAll(async () => {
  await db
    .deleteFrom("onboardingApplication")
    .where("userId", "in", [applicantId, otherApplicantId])
    .execute()
  await db.deleteFrom("inviteCode").where("createdByUserId", "=", inviterId).execute()
  await db
    .deleteFrom("user")
    .where("id", "in", [inviterId, applicantId, otherApplicantId, adminId])
    .execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("invite codes + onboarding flow", () => {
  let code: string

  it("creates codes up to the active limit, then refuses", async () => {
    for (let i = 0; i < MAX_ACTIVE_INVITE_CODES; i++) {
      const result = await crudInviteCode(db).createInviteCode(inviterId)
      expect(result.ok).toBe(true)
      if (result.ok && i === 0) code = result.inviteCode.code
    }
    const overLimit = await crudInviteCode(db).createInviteCode(inviterId)
    expect(overLimit).toEqual({ ok: false, reason: "ACTIVE_LIMIT_REACHED" })
  })

  it("revoking an active code frees an active slot", async () => {
    const { active, total } = await fetchInviteCode(db).countByCreator(inviterId)
    expect({ active, total }).toEqual({ active: 3, total: 3 })

    const codes = await fetchInviteCode(db).listByCreator(inviterId)
    const revokable = codes.find((c) => c.code !== code)
    expect(revokable).toBeDefined()
    expect(await crudInviteCode(db).revoke(revokable!.id, inviterId)).toBe(true)
    // A revoked code cannot be revoked twice or consumed.
    expect(await crudInviteCode(db).revoke(revokable!.id, inviterId)).toBe(false)
    expect(await crudInviteCode(db).consumeCode(revokable!.code, applicantId)).toBeUndefined()

    expect(await fetchInviteCode(db).countByCreator(inviterId)).toEqual({ active: 2, total: 3 })
  })

  it("submits an application, consuming the code and setting user pending", async () => {
    const result = await crudOnboardingApplication(db).submit(applicantId, code, LINKS)
    expect(result.ok).toBe(true)
    expect(await verificationStatus(applicantId)).toBe("pending")

    const application = await fetchOnboardingApplication(db).getByUserId(applicantId)
    expect(application?.status).toBe("pending")
    expect(application?.profileLink).toBe(LINKS.profileLink)
  })

  it("rejects an invalid or already-used code", async () => {
    const bad = await crudOnboardingApplication(db).submit(
      otherApplicantId,
      "NOPE-NOPE-NOPE",
      LINKS,
    )
    expect(bad).toEqual({ ok: false, reason: "INVALID_CODE" })
    const reused = await crudOnboardingApplication(db).submit(otherApplicantId, code, LINKS)
    expect(reused).toEqual({ ok: false, reason: "INVALID_CODE" })
  })

  it("rejects a double submission", async () => {
    const result = await crudOnboardingApplication(db).submit(applicantId, code, LINKS)
    expect(result).toEqual({ ok: false, reason: "ALREADY_SUBMITTED" })
  })

  it("reject -> edit resubmits and re-enters the queue", async () => {
    const application = await fetchOnboardingApplication(db).getByUserId(applicantId)
    const review = await crudOnboardingApplication(db).review(application!.id, {
      approve: false,
      reason: "Profile link is not fully public",
      adminUserId: adminId,
    })
    expect(review.ok).toBe(true)
    expect(await verificationStatus(applicantId)).toBe("rejected")

    // Double review is refused.
    const again = await crudOnboardingApplication(db).review(application!.id, {
      approve: true,
      adminUserId: adminId,
    })
    expect(again).toEqual({ ok: false, reason: "NOT_PENDING" })

    const updated = await crudOnboardingApplication(db).updateLinks(applicantId, {
      ...LINKS,
      profileLink: "https://reddit.com/user/example-public",
    })
    expect(updated?.status).toBe("pending")
    expect(updated?.rejectionReason).toBeNull()
    expect(await verificationStatus(applicantId)).toBe("pending")
  })

  it("approve marks the user verified", async () => {
    const application = await fetchOnboardingApplication(db).getByUserId(applicantId)
    const review = await crudOnboardingApplication(db).review(application!.id, {
      approve: true,
      adminUserId: adminId,
    })
    expect(review.ok).toBe(true)
    expect(await verificationStatus(applicantId)).toBe("verified")

    // Approved applications can no longer be edited.
    const editAfterApproval = await crudOnboardingApplication(db).updateLinks(applicantId, LINKS)
    expect(editAfterApproval).toBeUndefined()
  })

  it("referral appears in the inviter's list with a default nickname", async () => {
    const codes = await fetchInviteCode(db).listByCreator(inviterId)
    const used = codes.find((c) => c.referral !== null)
    expect(used?.referral?.userId).toBe(applicantId)
    expect(used?.referral?.nickname).toBe("Referral 1")

    expect(await crudInviteCode(db).setNickname(used!.id, inviterId, "Policy friend")).toBe(true)
    const renamed = await fetchInviteCode(db).listByCreator(inviterId)
    expect(renamed.find((c) => c.id === used!.id)?.referral?.nickname).toBe("Policy friend")
  })

  it("parallel submissions with the same code produce exactly one winner", async () => {
    const raceCode = await crudInviteCode(db).createInviteCode(inviterId)
    expect(raceCode.ok).toBe(true)
    if (!raceCode.ok) return

    const [a, b] = await Promise.all([
      crudOnboardingApplication(db).submit(otherApplicantId, raceCode.inviteCode.code, LINKS),
      crudOnboardingApplication(db).submit(otherApplicantId, raceCode.inviteCode.code, LINKS),
    ])
    const okCount = [a, b].filter((r) => r.ok).length
    expect(okCount).toBe(1)
  })
})

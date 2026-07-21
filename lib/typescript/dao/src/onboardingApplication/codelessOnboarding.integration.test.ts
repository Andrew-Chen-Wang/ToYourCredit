import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudOnboardingApplication } from "./crud"
import { fetchOnboardingApplication } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const applicantId = v7()
const adminId = v7()

const LINKS = {
  profileLink: "https://reddit.com/user/codeless",
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
        id: applicantId,
        username: `codeless-${suffix}`,
        email: `codeless-${suffix}@example.invalid`,
      },
      {
        id: adminId,
        username: `codeless-adm-${suffix}`,
        email: `codeless-adm-${suffix}@example.invalid`,
        isAdmin: true,
        verificationStatus: "verified",
      },
    ])
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("onboardingApplication").where("userId", "=", applicantId).execute()
  await db.deleteFrom("user").where("id", "in", [applicantId, adminId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("codeless onboarding applications", () => {
  it("still requires the four links without a code", async () => {
    const result = await crudOnboardingApplication(db).submit(applicantId, null, null)
    expect(result).toEqual({ ok: false, reason: "LINKS_REQUIRED" })
    expect(await verificationStatus(applicantId)).toBe("unverified")
  })

  it("still rejects an invalid code when one is provided", async () => {
    const result = await crudOnboardingApplication(db).submit(applicantId, "NOPE-NOPE-NOPE", LINKS)
    expect(result).toEqual({ ok: false, reason: "INVALID_CODE" })
  })

  it("submits without a code and sets the user pending", async () => {
    const result = await crudOnboardingApplication(db).submit(applicantId, null, LINKS)
    expect(result.ok).toBe(true)
    const application = await fetchOnboardingApplication(db).getByUserId(applicantId)
    expect(application?.inviteCodeId).toBeNull()
    expect(await verificationStatus(applicantId)).toBe("pending")
  })

  it("rejects a double submission", async () => {
    const result = await crudOnboardingApplication(db).submit(applicantId, null, LINKS)
    expect(result).toEqual({ ok: false, reason: "ALREADY_SUBMITTED" })
  })

  it("appears in the admin queue with no inviter", async () => {
    const queue = await fetchOnboardingApplication(db).listByStatus("pending", 100)
    const application = queue.find((a) => a.applicant.id === applicantId)
    expect(application).toBeDefined()
    expect(application?.inviter).toBeNull()
  })

  it("approve marks the codeless user verified", async () => {
    const application = await fetchOnboardingApplication(db).getByUserId(applicantId)
    const review = await crudOnboardingApplication(db).review(application!.id, {
      approve: true,
      adminUserId: adminId,
    })
    expect(review.ok).toBe(true)
    expect(await verificationStatus(applicantId)).toBe("verified")
  })
})

import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"
import { crudInviteCode } from "../inviteCode/crud"

export interface OnboardingLinks {
  profileLink: string
  opinionLink: string
  criticalThinkingLink: string
  acceptWrongLink: string
}

export type SubmitApplicationResult =
  | { ok: true; superuser: false; application: Selectable<DB["onboardingApplication"]> }
  /** A superuser bypass code was redeemed: no application row, user auto-verified. */
  | { ok: true; superuser: true }
  | { ok: false; reason: "INVALID_CODE" | "ALREADY_SUBMITTED" | "LINKS_REQUIRED" }

export type ReviewApplicationResult =
  | { ok: true; application: Selectable<DB["onboardingApplication"]> }
  | { ok: false; reason: "NOT_PENDING" }

class LinksRequiredError extends Error {}

export function crudOnboardingApplication(db: Kysely<DB>) {
  async function submit(
    userId: string,
    inviteCode: string | null,
    links: OnboardingLinks | null,
  ): Promise<SubmitApplicationResult> {
    const existing = await db
      .selectFrom("onboardingApplication")
      .select("id")
      .where("userId", "=", userId)
      .executeTakeFirst()
    if (existing) return { ok: false, reason: "ALREADY_SUBMITTED" }

    return await db
      .transaction()
      .execute(async (trx) => {
        const consumed = inviteCode
          ? await crudInviteCode(trx).consumeCode(inviteCode, userId)
          : null
        if (inviteCode && !consumed) {
          return { ok: false as const, reason: "INVALID_CODE" as const }
        }

        if (consumed?.isSuperuser) {
          // Admin bypass: no application to review, straight to verified.
          await trx
            .updateTable("user")
            .set({ verificationStatus: "verified" })
            .where("id", "=", userId)
            .execute()
          return { ok: true as const, superuser: true as const }
        }

        // Rolls back the code consumption when a normal code arrives without links.
        if (!links) throw new LinksRequiredError()

        const application = await trx
          .insertInto("onboardingApplication")
          .values({ id: v7(), userId, inviteCodeId: consumed?.id ?? null, ...links })
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .updateTable("user")
          .set({ verificationStatus: "pending" })
          .where("id", "=", userId)
          .execute()

        return { ok: true as const, superuser: false as const, application }
      })
      .catch((error: unknown) => {
        if (error instanceof LinksRequiredError) {
          return { ok: false as const, reason: "LINKS_REQUIRED" as const }
        }
        throw error
      })
  }

  async function updateLinks(
    userId: string,
    links: OnboardingLinks,
  ): Promise<Selectable<DB["onboardingApplication"]> | undefined> {
    return await db.transaction().execute(async (trx) => {
      // Editing while pending keeps the queue position; editing after rejection
      // is a resubmission that re-enters the queue.
      const application = await trx
        .updateTable("onboardingApplication")
        .set((eb) => ({
          ...links,
          updatedAt: new Date(),
          submittedAt: eb
            .case()
            .when("status", "=", "rejected")
            .then(new Date())
            .else(eb.ref("submittedAt"))
            .end(),
          rejectionReason: null,
          reviewedByUserId: null,
          reviewedAt: null,
          status: "pending",
        }))
        .where("userId", "=", userId)
        .where("status", "in", ["pending", "rejected"])
        .returningAll()
        .executeTakeFirst()
      if (!application) return undefined

      await trx
        .updateTable("user")
        .set({ verificationStatus: "pending" })
        .where("id", "=", userId)
        .execute()

      return application
    })
  }

  async function review(
    applicationId: string,
    input: { approve: boolean; reason?: string; adminUserId: string },
  ): Promise<ReviewApplicationResult> {
    return await db.transaction().execute(async (trx) => {
      const application = await trx
        .updateTable("onboardingApplication")
        .set({
          status: input.approve ? "approved" : "rejected",
          rejectionReason: input.approve ? null : (input.reason ?? null),
          reviewedByUserId: input.adminUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where("id", "=", applicationId)
        .where("status", "=", "pending")
        .returningAll()
        .executeTakeFirst()
      if (!application) return { ok: false, reason: "NOT_PENDING" as const }

      await trx
        .updateTable("user")
        .set({ verificationStatus: input.approve ? "verified" : "rejected" })
        .where("id", "=", application.userId)
        .execute()

      return { ok: true, application }
    })
  }

  return { submit, updateLinks, review }
}

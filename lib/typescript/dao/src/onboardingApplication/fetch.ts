import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export interface OnboardingApplicationForReview {
  id: string
  status: string
  profileLink: string
  opinionLink: string
  criticalThinkingLink: string
  acceptWrongLink: string
  rejectionReason: string | null
  submittedAt: Date
  reviewedAt: Date | null
  applicant: {
    id: string
    username: string
    email: string
    createdAt: Date
  }
  inviter: {
    id: string
    username: string
  } | null
}

export function fetchOnboardingApplication(db: Kysely<DB>) {
  async function getByUserId(
    userId: string,
  ): Promise<Selectable<DB["onboardingApplication"]> | undefined> {
    return await db
      .selectFrom("onboardingApplication")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst()
  }

  async function listByStatus(
    status: "pending" | "approved" | "rejected",
    limit: number,
    cursor?: string,
  ): Promise<OnboardingApplicationForReview[]> {
    let query = db
      .selectFrom("onboardingApplication")
      .innerJoin("user as applicant", "applicant.id", "onboardingApplication.userId")
      .innerJoin("inviteCode", "inviteCode.id", "onboardingApplication.inviteCodeId")
      .leftJoin("user as inviter", "inviter.id", "inviteCode.createdByUserId")
      .select([
        "onboardingApplication.id",
        "onboardingApplication.status",
        "onboardingApplication.profileLink",
        "onboardingApplication.opinionLink",
        "onboardingApplication.criticalThinkingLink",
        "onboardingApplication.acceptWrongLink",
        "onboardingApplication.rejectionReason",
        "onboardingApplication.submittedAt",
        "onboardingApplication.reviewedAt",
        "applicant.id as applicantId",
        "applicant.username as applicantUsername",
        "applicant.email as applicantEmail",
        "applicant.createdAt as applicantCreatedAt",
        "inviter.id as inviterId",
        "inviter.username as inviterUsername",
      ])
      .where("onboardingApplication.status", "=", status)
      .orderBy("onboardingApplication.submittedAt", "asc")
      .orderBy("onboardingApplication.id", "asc")
      .limit(limit)

    if (cursor) {
      const cursorRow = await db
        .selectFrom("onboardingApplication")
        .select(["submittedAt", "id"])
        .where("id", "=", cursor)
        .executeTakeFirst()
      if (cursorRow) {
        query = query.where((eb) =>
          eb.or([
            eb("onboardingApplication.submittedAt", ">", cursorRow.submittedAt),
            eb.and([
              eb("onboardingApplication.submittedAt", "=", cursorRow.submittedAt),
              eb("onboardingApplication.id", ">", cursorRow.id),
            ]),
          ]),
        )
      }
    }

    const rows = await query.execute()
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      profileLink: row.profileLink,
      opinionLink: row.opinionLink,
      criticalThinkingLink: row.criticalThinkingLink,
      acceptWrongLink: row.acceptWrongLink,
      rejectionReason: row.rejectionReason,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      applicant: {
        id: row.applicantId,
        username: row.applicantUsername,
        email: row.applicantEmail,
        createdAt: row.applicantCreatedAt,
      },
      inviter:
        row.inviterId && row.inviterUsername
          ? { id: row.inviterId, username: row.inviterUsername }
          : null,
    }))
  }

  return { getByUserId, listByStatus }
}

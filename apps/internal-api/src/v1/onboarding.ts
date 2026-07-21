import {
  crudOnboardingApplication,
  crudUser,
  fetchInviteCode,
  fetchOnboardingApplication,
} from "@lib/dao"
import type { DB } from "@template-nextjs/db"
import { db } from "@template-nextjs/db"
import { enqueueEsSyncUser } from "@utils/queues"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import type { Selectable } from "kysely"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { ErrorCode } from "../utils/errors.enum"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import {
  onboardingCheckCodeSchemaRequest,
  onboardingCheckCodeSchemaResponse,
  onboardingMeSchemaResponse,
  onboardingSchemaRequest,
  onboardingSchemaResponse,
  onboardingUpdateSchemaRequest,
  onboardingUsernameSchemaRequest,
  onboardingUsernameSchemaResponse,
} from "./onboarding.serializer"

function serializeApplication(application: Selectable<DB["onboardingApplication"]>) {
  return {
    id: application.id,
    status: application.status,
    profileLink: application.profileLink,
    opinionLink: application.opinionLink,
    criticalThinkingLink: application.criticalThinkingLink,
    acceptWrongLink: application.acceptWrongLink,
    rejectionReason: application.rejectionReason,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
  }
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/me",
    describeRoute({
      description: "The current user's onboarding application, if any",
      responses: {
        200: {
          description: "Onboarding application or null",
          content: { "application/json": { schema: resolver(onboardingMeSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const application = await fetchOnboardingApplication(db).getByUserId(user.id)
      return c.json({ application: application ? serializeApplication(application) : null })
    },
  )
  .post(
    "/check-code",
    describeRoute({
      description:
        "Check an invite code before submitting: whether it is redeemable and whether it is an admin bypass code that skips the four links",
      responses: {
        200: {
          description: "Code status",
          content: { "application/json": { schema: resolver(onboardingCheckCodeSchemaResponse) } },
        },
      },
    }),
    validator("json", onboardingCheckCodeSchemaRequest),
    async (c) => {
      const { inviteCode } = c.req.valid("json")
      const code = await fetchInviteCode(db).getByCode(inviteCode.trim().toUpperCase())
      return c.json({
        valid: code?.active === true,
        superuser: code?.active === true && code.isSuperuser,
      })
    },
  )
  .post(
    "/username",
    describeRoute({
      description:
        "Claim a username during onboarding. Only available while unverified; does not consume the one-time username change and may be repeated until verification",
      responses: {
        200: {
          description: "Username claimed",
          content: { "application/json": { schema: resolver(onboardingUsernameSchemaResponse) } },
        },
        400: {
          description: "Username taken, or user is past onboarding",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", onboardingUsernameSchemaRequest),
    async (c) => {
      const user = c.var.user
      if (user.verificationStatus !== "unverified") {
        return throwBadRequest(c, "Usernames can only be claimed during onboarding")
      }

      const { username } = c.req.valid("json")
      const result = await crudUser(db).claimUsername(user.id, username)
      if (!result.ok) {
        if (result.reason === "TAKEN") {
          return throwBadRequest(c, "That username is taken", ErrorCode.ResourceAlreadyExists, {
            target: "username",
          })
        }
        return throwNotFound(c, "User not found")
      }
      await enqueueEsSyncUser(user.id)

      return c.json({ username: result.username })
    },
  )
  .post(
    "/",
    describeRoute({
      description:
        "Submit the onboarding application: four required public links plus an optional invite code that records who referred you (admin bypass codes skip the links and auto-verify)",
      responses: {
        201: {
          description: "Application submitted",
          content: { "application/json": { schema: resolver(onboardingSchemaResponse) } },
        },
        400: {
          description: "Invalid or used invite code, or already submitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", onboardingSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      if (user.verificationStatus !== "unverified") {
        return throwBadRequest(
          c,
          "An onboarding application was already submitted",
          ErrorCode.AlreadySubmitted,
        )
      }

      const links =
        body.profileLink && body.opinionLink && body.criticalThinkingLink && body.acceptWrongLink
          ? {
              profileLink: body.profileLink,
              opinionLink: body.opinionLink,
              criticalThinkingLink: body.criticalThinkingLink,
              acceptWrongLink: body.acceptWrongLink,
            }
          : null

      // A whitespace-only code counts as no code at all.
      const trimmedCode = body.inviteCode?.trim()
      const result = await crudOnboardingApplication(db).submit(
        user.id,
        trimmedCode?.length ? trimmedCode.toUpperCase() : null,
        links,
      )
      if (!result.ok) {
        if (result.reason === "ALREADY_SUBMITTED") {
          return throwBadRequest(
            c,
            "An onboarding application was already submitted",
            ErrorCode.AlreadySubmitted,
          )
        }
        if (result.reason === "LINKS_REQUIRED") {
          return throwBadRequest(c, "All four links are required")
        }
        return throwBadRequest(c, "That invite code is not valid", ErrorCode.InviteCodeInvalid, {
          target: "inviteCode",
        })
      }

      if (result.superuser) {
        return c.json({ application: null, superuser: true }, 201)
      }
      return c.json(
        { application: serializeApplication(result.application), superuser: false },
        201,
      )
    },
  )
  .patch(
    "/",
    describeRoute({
      description:
        "Edit the four onboarding links; editing after a rejection resubmits the application",
      responses: {
        200: {
          description: "Application updated",
          content: { "application/json": { schema: resolver(onboardingSchemaResponse) } },
        },
        400: {
          description: "Application already approved",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "No application to edit",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", onboardingUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const existing = await fetchOnboardingApplication(db).getByUserId(user.id)
      if (!existing) return throwNotFound(c, "No onboarding application found")
      if (existing.status === "approved") {
        return throwBadRequest(c, "Application already approved")
      }

      const application = await crudOnboardingApplication(db).updateLinks(user.id, body)
      if (!application) return throwNotFound(c, "No onboarding application found")

      return c.json({ application: serializeApplication(application) })
    },
  )

export default app

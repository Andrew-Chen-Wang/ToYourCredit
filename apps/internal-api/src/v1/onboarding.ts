import { crudOnboardingApplication, fetchOnboardingApplication } from "@lib/dao"
import type { DB } from "@template-nextjs/db"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import type { Selectable } from "kysely"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { ErrorCode } from "../utils/errors.enum"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import {
  onboardingMeSchemaResponse,
  onboardingSchemaRequest,
  onboardingSchemaResponse,
  onboardingUpdateSchemaRequest,
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
    "/",
    describeRoute({
      description:
        "Submit the onboarding application: an invite code plus four required public links",
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

      const result = await crudOnboardingApplication(db).submit(
        user.id,
        body.inviteCode.trim().toUpperCase(),
        {
          profileLink: body.profileLink,
          opinionLink: body.opinionLink,
          criticalThinkingLink: body.criticalThinkingLink,
          acceptWrongLink: body.acceptWrongLink,
        },
      )
      if (!result.ok) {
        if (result.reason === "ALREADY_SUBMITTED") {
          return throwBadRequest(
            c,
            "An onboarding application was already submitted",
            ErrorCode.AlreadySubmitted,
          )
        }
        return throwBadRequest(c, "That invite code is not valid", ErrorCode.InviteCodeInvalid, {
          target: "inviteCode",
        })
      }

      return c.json({ application: serializeApplication(result.application) }, 201)
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

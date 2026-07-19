import { crudOnboardingApplication, fetchOnboardingApplication } from "@lib/dao"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { throwBadRequest } from "../utils/http-exception"
import { adminAuthMiddleware } from "./middleware"
import {
  adminOnboardingRejectSchemaRequest,
  adminOnboardingSchemaQuery,
  adminOnboardingSchemaResponse,
} from "./onboarding.serializer"

const PAGE_SIZE = 25

const app = new Hono()
  .use(adminAuthMiddleware)
  .get(
    "/",
    describeRoute({
      description: "List onboarding applications for review",
      responses: {
        200: {
          description: "Applications with applicant and inviter details",
          content: { "application/json": { schema: resolver(adminOnboardingSchemaResponse) } },
        },
      },
    }),
    validator("query", adminOnboardingSchemaQuery),
    async (c) => {
      const query = c.req.valid("query")
      const status = query.status ?? "pending"
      const cursor = query.cursor ?? undefined
      const rows = await fetchOnboardingApplication(db).listByStatus(status, PAGE_SIZE, cursor)
      return c.json({
        data: rows,
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null,
      })
    },
  )
  .post(
    "/:id/approve",
    describeRoute({
      description: "Approve an onboarding application, verifying the user",
      responses: {
        200: {
          description: "Application approved",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        400: {
          description: "Application is not pending",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const result = await crudOnboardingApplication(db).review(id, {
        approve: true,
        adminUserId: user.id,
      })
      if (!result.ok) return throwBadRequest(c, "Application is not pending review")
      return c.json({})
    },
  )
  .post(
    "/:id/reject",
    describeRoute({
      description: "Reject an onboarding application with a reason",
      responses: {
        200: {
          description: "Application rejected",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        400: {
          description: "Application is not pending",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    validator("json", adminOnboardingRejectSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const { reason } = c.req.valid("json")
      const result = await crudOnboardingApplication(db).review(id, {
        approve: false,
        reason,
        adminUserId: user.id,
      })
      if (!result.ok) return throwBadRequest(c, "Application is not pending review")
      return c.json({})
    },
  )

export default app

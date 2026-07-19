import { crudInviteCode, fetchInviteCode } from "@lib/dao"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver } from "hono-typebox-openapi/typebox"
import { adminAuthMiddleware } from "./middleware"
import {
  adminInviteCodeCreateSchemaResponse,
  adminInviteCodeListSchemaResponse,
} from "./invite-code.serializer"

const app = new Hono()
  .use(adminAuthMiddleware)
  .get(
    "/",
    describeRoute({
      description: "List superuser bypass invite codes",
      responses: {
        200: {
          description: "Superuser codes with creator and redeemer",
          content: { "application/json": { schema: resolver(adminInviteCodeListSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const codes = await fetchInviteCode(db).listSuperuserCodes()
      return c.json({ data: codes })
    },
  )
  .post(
    "/",
    describeRoute({
      description:
        "Create a single-use superuser bypass invite code: redeeming it skips the four-link application and auto-verifies the user",
      responses: {
        201: {
          description: "Superuser code created",
          content: {
            "application/json": { schema: resolver(adminInviteCodeCreateSchemaResponse) },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const code = await crudInviteCode(db).createSuperuserCode(user.id)
      return c.json({ id: code.id, code: code.code, createdAt: code.createdAt }, 201)
    },
  )

export default app

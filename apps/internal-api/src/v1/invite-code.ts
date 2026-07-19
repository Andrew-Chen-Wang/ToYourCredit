import {
  crudInviteCode,
  fetchInviteCode,
  MAX_ACTIVE_INVITE_CODES,
  MAX_TOTAL_INVITE_CODES,
} from "@lib/dao"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { verifiedMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { ErrorCode } from "../utils/errors.enum"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import {
  inviteCodeCreateSchemaResponse,
  inviteCodeListSchemaResponse,
  inviteCodeNicknameSchemaRequest,
  inviteCodeSchemaParam,
} from "./invite-code.serializer"

const app = new Hono()
  .use(verifiedMiddleware)
  .get(
    "/",
    describeRoute({
      description: "The current user's invite codes and the referrals they brought in",
      responses: {
        200: {
          description: "Invite codes with referral info",
          content: { "application/json": { schema: resolver(inviteCodeListSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const [codes, counts] = await Promise.all([
        fetchInviteCode(db).listByCreator(user.id),
        fetchInviteCode(db).countByCreator(user.id),
      ])
      return c.json({
        data: codes.map((code) => ({
          id: code.id,
          code: code.code,
          status: code.usedAt
            ? ("used" as const)
            : code.revokedAt
              ? ("revoked" as const)
              : ("active" as const),
          createdAt: code.createdAt,
          usedAt: code.usedAt,
          referral: code.referral,
        })),
        activeCount: counts.active,
        totalCount: counts.total,
        maxActive: MAX_ACTIVE_INVITE_CODES,
        maxTotal: MAX_TOTAL_INVITE_CODES,
      })
    },
  )
  .post(
    "/",
    describeRoute({
      description: "Generate a new single-use invite code",
      responses: {
        201: {
          description: "Invite code created",
          content: { "application/json": { schema: resolver(inviteCodeCreateSchemaResponse) } },
        },
        400: {
          description: "Invite code limit reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const result = await crudInviteCode(db).createInviteCode(user.id)
      if (!result.ok) {
        const message =
          result.reason === "TOTAL_LIMIT_REACHED"
            ? `You have created the maximum of ${MAX_TOTAL_INVITE_CODES} invite codes`
            : `You can only have ${MAX_ACTIVE_INVITE_CODES} active invite codes at a time`
        return throwBadRequest(c, message, ErrorCode.InviteCodeLimitReached)
      }
      return c.json(
        {
          id: result.inviteCode.id,
          code: result.inviteCode.code,
          createdAt: result.inviteCode.createdAt,
        },
        201,
      )
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Revoke an unused invite code",
      responses: {
        200: {
          description: "Invite code revoked",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "Invite code not found or already used",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", inviteCodeSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const revoked = await crudInviteCode(db).revoke(id, user.id)
      if (!revoked) return throwNotFound(c, "Invite code not found or already used")
      return c.json({})
    },
  )
  .patch(
    "/:id/nickname",
    describeRoute({
      description: "Set a nickname for the referral who used this invite code",
      responses: {
        200: {
          description: "Nickname updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "Invite code not found or not used yet",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", inviteCodeSchemaParam),
    validator("json", inviteCodeNicknameSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const { nickname } = c.req.valid("json")
      const updated = await crudInviteCode(db).setNickname(id, user.id, nickname.trim())
      if (!updated) return throwNotFound(c, "Invite code not found or not used yet")
      return c.json({})
    },
  )

export default app

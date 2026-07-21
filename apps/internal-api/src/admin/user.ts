import {
  crudUser,
  crudUserStrike,
  emitAccountStrike,
  fetchAdmin,
  fetchComment,
  fetchPost,
  fetchUser,
  fetchUserStrike,
  strikeWindowStart,
} from "@lib/dao"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import { adminAuthMiddleware } from "./middleware"
import {
  adminStrikeIssueSchemaResponse,
  adminStrikeListSchemaResponse,
  adminStrikeParamSchemaParam,
  adminStrikeSchemaRequest,
  adminSuspendSchemaRequest,
  adminUserSchemaQuery,
  adminUserSchemaResponse,
} from "./user.serializer"

const STRIKE_SUSPEND_THRESHOLD = 5
const AUTO_SUSPEND_REASON = "Automatic suspension: 5 strikes within 365 days"

const PAGE_SIZE = 25

interface AdminUserListItem {
  id: string
  username: string
  email: string
  postKarma: number
  commentKarma: number
  createdAt: string
  suspendedAt: string | null
  suspensionReason: string | null
  activeStrikeCount: number
}

interface AdminUserListPayload {
  data: AdminUserListItem[]
  nextCursor: string | null
}

const app = new Hono()
  .use(adminAuthMiddleware)
  .get(
    "/",
    describeRoute({
      description: "Search users by username or email",
      responses: {
        200: {
          description: "Matching users",
          content: { "application/json": { schema: resolver(adminUserSchemaResponse) } },
        },
      },
    }),
    validator("query", adminUserSchemaQuery),
    async (c) => {
      const query = c.req.valid("query")
      const q = query.q ?? null
      const cursor = query.cursor ?? null
      const rows = await fetchAdmin(db).searchUsers(q, cursor, PAGE_SIZE)
      const payload: AdminUserListPayload = {
        data: rows.map((r) => ({
          id: r.id,
          username: r.username,
          email: r.email,
          postKarma: r.postKarma,
          commentKarma: r.commentKarma,
          createdAt: r.createdAt.toISOString(),
          suspendedAt: r.suspendedAt ? r.suspendedAt.toISOString() : null,
          suspensionReason: r.suspensionReason,
          activeStrikeCount: r.activeStrikeCount,
        })),
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null,
      }
      return c.json(payload)
    },
  )
  .post(
    "/:id/suspend",
    describeRoute({
      description: "Suspend a user site-wide",
      responses: {
        200: {
          description: "User suspended",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    validator("json", adminSuspendSchemaRequest),
    async (c) => {
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const target = await fetchUser(db).getOne(id, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudUser(db).suspend(id, body.reason ?? null)
      return c.json({})
    },
  )
  .post(
    "/:id/unsuspend",
    describeRoute({
      description: "Lift a user's suspension",
      responses: {
        200: {
          description: "User unsuspended",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const { id } = c.req.valid("param")
      const target = await fetchUser(db).getOne(id, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudUser(db).unsuspend(id)
      return c.json({})
    },
  )
  .post(
    "/:id/strike",
    describeRoute({
      description:
        "Issue a site-wide strike against a user, optionally attached to one of their posts or comments. The 5th active strike within 365 days auto-suspends the account.",
      responses: {
        200: {
          description: "Strike issued",
          content: { "application/json": { schema: resolver(adminStrikeIssueSchemaResponse) } },
        },
        400: {
          description: "Invalid strike request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    validator("json", adminStrikeSchemaRequest),
    async (c) => {
      const admin = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const postId = body.postId ?? null
      const commentId = body.commentId ?? null

      if (id === admin.id) return throwBadRequest(c, "You cannot strike yourself")
      if (postId && commentId) {
        return throwBadRequest(c, "Attach a post or a comment, not both")
      }
      const target = await fetchUser(db).getOne(id, ["id", "suspendedAt"])
      if (!target) return throwNotFound(c, "User not found")

      if (postId) {
        const post = await fetchPost(db).getOne(postId, ["authorUserId"])
        if (!post || post.authorUserId !== id) {
          return throwBadRequest(c, "Post does not belong to this user")
        }
        if (await fetchUserStrike(db).hasActiveForContent({ postId })) {
          return throwBadRequest(c, "This post already has an active strike")
        }
      }
      if (commentId) {
        const comment = await fetchComment(db).getOne(commentId, ["authorUserId", "isDeleted"])
        if (!comment || comment.isDeleted || comment.authorUserId !== id) {
          return throwBadRequest(c, "Comment does not belong to this user")
        }
        if (await fetchUserStrike(db).hasActiveForContent({ commentId })) {
          return throwBadRequest(c, "This comment already has an active strike")
        }
      }

      const result = await db.transaction().execute(async (tx) => {
        const strike = await crudUserStrike(tx).issue({
          userId: id,
          issuedByUserId: admin.id,
          reason: body.reason,
          postId,
          commentId,
        })
        const activeCount = await fetchUserStrike(tx).countActive(id)
        let suspended = false
        if (activeCount >= STRIKE_SUSPEND_THRESHOLD && !target.suspendedAt) {
          await crudUser(tx).suspend(id, AUTO_SUSPEND_REASON)
          suspended = true
        }
        return { id: strike.id, activeCount, suspended }
      })

      await emitAccountStrike(db, {
        userId: id,
        reason: body.reason,
        activeCount: result.activeCount,
      })
      return c.json(result)
    },
  )
  .post(
    "/:id/strike/:strikeId/revoke",
    describeRoute({
      description:
        "Revoke a strike. Does not lift an existing suspension — unsuspend separately if appropriate.",
      responses: {
        200: {
          description: "Strike revoked",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        400: {
          description: "Strike already revoked",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Strike not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", adminStrikeParamSchemaParam),
    async (c) => {
      const admin = c.var.user
      const { id, strikeId } = c.req.valid("param")
      const strike = await fetchUserStrike(db).getOne(strikeId, ["userId"])
      if (!strike || strike.userId !== id) return throwNotFound(c, "Strike not found")
      const revoked = await crudUserStrike(db).revoke(strikeId, admin.id)
      if (!revoked) return throwBadRequest(c, "Strike already revoked")
      return c.json({})
    },
  )
  .get(
    "/:id/strikes",
    describeRoute({
      description: "List all strikes for a user, including revoked ones",
      responses: {
        200: {
          description: "Strikes for the user",
          content: { "application/json": { schema: resolver(adminStrikeListSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const { id } = c.req.valid("param")
      const target = await fetchUser(db).getOne(id, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      const [rows, activeCount] = await Promise.all([
        fetchUserStrike(db).listForUserAdmin(id),
        fetchUserStrike(db).countActive(id),
      ])
      const windowStart = strikeWindowStart()
      return c.json({
        data: rows.map((r) => ({
          id: r.id,
          reason: r.reason,
          postId: r.postId,
          commentId: r.commentId,
          createdAt: r.createdAt.toISOString(),
          revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
          issuedByUsername: r.issuedByUsername,
          revokedByUsername: r.revokedByUsername,
          active: r.revokedAt === null && r.createdAt > windowStart,
        })),
        activeCount,
      })
    },
  )

export default app

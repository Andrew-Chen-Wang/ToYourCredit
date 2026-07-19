import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { emitPostUpvoteMilestone } from "@lib/dao/notification/emit-helpers"
import { isUpvoteMilestone } from "@lib/dao/notification/types"
import { fetchPost } from "@lib/dao/post/fetch"
import { crudPostVote } from "@lib/dao/postVote/crud"
import { fetchPostVote } from "@lib/dao/postVote/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, verifiedMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  postDownvoterListSchemaQuery,
  postVoteSchemaParam,
  postVoteSchemaRequest,
  postVoteSchemaResponse,
  postVoteSummarySchemaResponse,
  postVoterListSchemaQuery,
  postVoterListSchemaResponse,
} from "./post-vote.serializer"

const ARCHIVE_AGE_MS = 180 * 24 * 60 * 60 * 1000
const DEFAULT_VOTER_PAGE = 25

async function assertViewablePost(postId: string, userId: string) {
  const meta = await fetchPost(db).getOne(postId, ["communityId", "removedAt"])
  if (!meta || meta.removedAt) return false
  if (meta.communityId) {
    const view = await getCommunityAuthz(db).canView(meta.communityId, userId)
    if (!view.ok) return false
  }
  return true
}

const app = new Hono()
  .use(authMiddleware)
  .put(
    "/:postId",
    verifiedMiddleware,
    describeRoute({
      description:
        "Give credit to a post, downvote it with one or more stated categories, or clear the vote",
      responses: {
        200: {
          description: "Updated vote counts",
          content: { "application/json": { schema: resolver(postVoteSchemaResponse) } },
        },
        403: {
          description: "Post is locked",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postVoteSchemaParam),
    validator("json", postVoteSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const body = c.req.valid("json")

      const meta = await fetchPost(db).getOne(postId, [
        "communityId",
        "isLocked",
        "removedAt",
        "createdAt",
        "authorUserId",
        "title",
      ])
      if (!meta || meta.removedAt) return throwNotFound(c, "Post not found")

      if (meta.communityId) {
        const view = await getCommunityAuthz(db).canView(meta.communityId, user.id)
        if (!view.ok) return throwNotFound(c, "Post not found")
        const community = await fetchCommunity(db).getOne(meta.communityId, ["archiveOldPosts"])
        if (community?.archiveOldPosts && meta.createdAt.getTime() < Date.now() - ARCHIVE_AGE_MS) {
          return throwForbidden(c, "This post has been archived")
        }
      }
      if (meta.isLocked) return throwForbidden(c, "This post is locked")

      const input =
        "credit" in body
          ? ({ type: "credit", active: body.credit } as const)
          : ({ type: "down", categories: body.downvoteCategories } as const)
      const result = await crudPostVote(db).setVote(postId, user.id, input)
      if (!result) return throwNotFound(c, "Post not found")

      if ("credit" in body && body.credit && isUpvoteMilestone(result.ups)) {
        await emitPostUpvoteMilestone(db, {
          postId,
          authorUserId: meta.authorUserId,
          actorUserId: user.id,
          ups: result.ups,
          title: meta.title,
          communityId: meta.communityId,
        })
      }

      return c.json(result)
    },
  )
  .get(
    "/:postId/upvoters",
    describeRoute({
      description: "Users who gave credit to a post",
      responses: {
        200: {
          description: "Paginated upvoter list",
          content: { "application/json": { schema: resolver(postVoterListSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postVoteSchemaParam),
    validator("query", postVoterListSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const query = c.req.valid("query")

      if (!(await assertViewablePost(postId, user.id))) {
        return throwNotFound(c, "Post not found")
      }

      const page = await fetchPostVote(db).listUpvoters(
        postId,
        query.limit ?? DEFAULT_VOTER_PAGE,
        query.cursor ?? undefined,
      )
      return c.json({ data: page.voters, nextCursor: page.nextCursor })
    },
  )
  .get(
    "/:postId/downvoters",
    describeRoute({
      description: "Users who downvoted a post, optionally filtered by category",
      responses: {
        200: {
          description: "Paginated downvoter list",
          content: { "application/json": { schema: resolver(postVoterListSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postVoteSchemaParam),
    validator("query", postDownvoterListSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const query = c.req.valid("query")

      if (!(await assertViewablePost(postId, user.id))) {
        return throwNotFound(c, "Post not found")
      }

      const page = await fetchPostVote(db).listDownvoters(
        postId,
        query.limit ?? DEFAULT_VOTER_PAGE,
        query.category ?? undefined,
        query.cursor ?? undefined,
      )
      return c.json({ data: page.voters, nextCursor: page.nextCursor })
    },
  )
  .get(
    "/:postId/downvote-summary",
    describeRoute({
      description: "Per-category downvote counts and the caller's own categories",
      responses: {
        200: {
          description: "Downvote summary",
          content: { "application/json": { schema: resolver(postVoteSummarySchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postVoteSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")

      if (!(await assertViewablePost(postId, user.id))) {
        return throwNotFound(c, "Post not found")
      }

      const [categoryCounts, myCategories] = await Promise.all([
        fetchPostVote(db).getCategoryCounts(postId),
        fetchPostVote(db).getMyCategories(postId, user.id),
      ])
      return c.json({ categoryCounts, myCategories })
    },
  )

export default app

import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchComment } from "@lib/dao/comment/fetch"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { crudCommentVote } from "@lib/dao/commentVote/crud"
import { fetchCommentVote } from "@lib/dao/commentVote/fetch"
import { emitCommentUpvoteMilestone } from "@lib/dao/notification/emit-helpers"
import { isUpvoteMilestone } from "@lib/dao/notification/types"
import { fetchPost } from "@lib/dao/post/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, verifiedMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  commentDownvoterListSchemaQuery,
  commentVoteSchemaParam,
  commentVoteSchemaRequest,
  commentVoteSchemaResponse,
  commentVoteSummarySchemaResponse,
  commentVoterListSchemaQuery,
  commentVoterListSchemaResponse,
} from "./comment.serializer"

const ARCHIVE_AGE_MS = 180 * 24 * 60 * 60 * 1000
const DEFAULT_VOTER_PAGE = 25

async function assertViewableComment(commentId: string, userId: string) {
  const comment = await fetchComment(db).getOne(commentId, ["postId"])
  if (!comment) return false
  const post = await fetchPost(db).getOne(comment.postId, ["communityId", "removedAt"])
  if (!post || post.removedAt) return false
  if (post.communityId) {
    const view = await getCommunityAuthz(db).canView(post.communityId, userId)
    if (!view.ok) return false
  }
  return true
}

const app = new Hono()
  .use(authMiddleware)
  .put(
    "/:commentId",
    verifiedMiddleware,
    describeRoute({
      description:
        "Give credit to a comment, downvote it with one or more stated categories, or clear the vote",
      responses: {
        200: {
          description: "Updated vote counts",
          content: { "application/json": { schema: resolver(commentVoteSchemaResponse) } },
        },
        403: {
          description: "Post is locked",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", commentVoteSchemaParam),
    validator("json", commentVoteSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      const body = c.req.valid("json")

      const comment = await fetchComment(db).getOne(commentId, ["postId", "authorUserId", "bodyMd"])
      if (!comment) return throwNotFound(c, "Comment not found")

      const post = await fetchPost(db).getOne(comment.postId, [
        "communityId",
        "isLocked",
        "removedAt",
        "createdAt",
      ])
      if (!post || post.removedAt) return throwNotFound(c, "Comment not found")
      if (post.communityId) {
        const view = await getCommunityAuthz(db).canView(post.communityId, user.id)
        if (!view.ok) return throwNotFound(c, "Comment not found")
        const community = await fetchCommunity(db).getOne(post.communityId, ["archiveOldPosts"])
        if (community?.archiveOldPosts && post.createdAt.getTime() < Date.now() - ARCHIVE_AGE_MS) {
          return throwForbidden(c, "This post has been archived")
        }
      }
      if (post.isLocked) return throwForbidden(c, "This post is locked")

      const input =
        "credit" in body
          ? ({ type: "credit", active: body.credit } as const)
          : ({ type: "down", categories: body.downvoteCategories } as const)
      const result = await crudCommentVote(db).setVote(commentId, user.id, input)
      if (!result) return throwNotFound(c, "Comment not found")

      if (
        "credit" in body &&
        body.credit &&
        comment.authorUserId &&
        isUpvoteMilestone(result.ups)
      ) {
        await emitCommentUpvoteMilestone(db, {
          postId: comment.postId,
          commentId,
          authorUserId: comment.authorUserId,
          actorUserId: user.id,
          ups: result.ups,
          bodyMd: comment.bodyMd,
          communityId: post.communityId,
        })
      }

      return c.json(result)
    },
  )
  .get(
    "/:commentId/upvoters",
    describeRoute({
      description: "Users who gave credit to a comment",
      responses: {
        200: {
          description: "Paginated upvoter list",
          content: { "application/json": { schema: resolver(commentVoterListSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", commentVoteSchemaParam),
    validator("query", commentVoterListSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      const query = c.req.valid("query")

      if (!(await assertViewableComment(commentId, user.id))) {
        return throwNotFound(c, "Comment not found")
      }

      const page = await fetchCommentVote(db).listUpvoters(
        commentId,
        query.limit ?? DEFAULT_VOTER_PAGE,
        query.cursor ?? undefined,
      )
      return c.json({ data: page.voters, nextCursor: page.nextCursor })
    },
  )
  .get(
    "/:commentId/downvoters",
    describeRoute({
      description: "Users who downvoted a comment, optionally filtered by category",
      responses: {
        200: {
          description: "Paginated downvoter list",
          content: { "application/json": { schema: resolver(commentVoterListSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", commentVoteSchemaParam),
    validator("query", commentDownvoterListSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      const query = c.req.valid("query")

      if (!(await assertViewableComment(commentId, user.id))) {
        return throwNotFound(c, "Comment not found")
      }

      const page = await fetchCommentVote(db).listDownvoters(
        commentId,
        query.limit ?? DEFAULT_VOTER_PAGE,
        query.category ?? undefined,
        query.cursor ?? undefined,
      )
      return c.json({ data: page.voters, nextCursor: page.nextCursor })
    },
  )
  .get(
    "/:commentId/downvote-summary",
    describeRoute({
      description: "Per-category downvote counts and the caller's own categories",
      responses: {
        200: {
          description: "Downvote summary",
          content: { "application/json": { schema: resolver(commentVoteSummarySchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", commentVoteSchemaParam),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")

      if (!(await assertViewableComment(commentId, user.id))) {
        return throwNotFound(c, "Comment not found")
      }

      const [categoryCounts, myCategories] = await Promise.all([
        fetchCommentVote(db).getCategoryCounts(commentId),
        fetchCommentVote(db).getMyCategories(commentId, user.id),
      ])
      return c.json({ categoryCounts, myCategories })
    },
  )

export default app

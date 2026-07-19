import { DOWNVOTE_CATEGORIES } from "@lib/dao"
import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const downvoteCategorySchema = Type.Union(
  DOWNVOTE_CATEGORIES.map((category) => Type.Literal(category)),
)

export const voteSchemaRequest = Type.Union([
  Type.Object({ credit: Type.Boolean() }),
  Type.Object({
    downvoteCategories: Type.Array(downvoteCategorySchema, {
      maxItems: DOWNVOTE_CATEGORIES.length,
    }),
  }),
])

export const voteSchemaResponse = Type.Object({
  ups: Type.Number(),
  downs: Type.Number(),
  score: Type.Number(),
  userVote: Type.Number(),
  myDownvoteCategories: Type.Array(Type.String()),
})

export const voterListSchemaQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const downvoterListSchemaQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, multipleOf: 1 })),
  category: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
})

export const voterListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      userId: UUID7String,
      username: Type.String(),
      displayName: Nullable(Type.String()),
      avatarImageKey: Nullable(Type.String()),
      votedAt: Type.String({ format: "date-time" }),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})

export const downvoteSummarySchemaResponse = Type.Object({
  categoryCounts: Type.Record(Type.String(), Type.Number()),
  myCategories: Type.Array(Type.String()),
})

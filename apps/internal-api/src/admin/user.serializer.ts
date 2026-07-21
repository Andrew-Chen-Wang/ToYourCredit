import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const adminUserSchemaQuery = Type.Object({
  q: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.String()),
})

export const adminUserSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      username: Type.String(),
      email: Type.String(),
      postKarma: Type.Number(),
      commentKarma: Type.Number(),
      createdAt: Type.String({ format: "date-time" }),
      suspendedAt: Nullable(Type.String({ format: "date-time" })),
      suspensionReason: Nullable(Type.String()),
      activeStrikeCount: Type.Number(),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})

export const adminSuspendSchemaRequest = Type.Object({
  reason: Nullable(Type.String()),
})

export const adminStrikeSchemaRequest = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 2000 }),
  postId: Type.Optional(Nullable(UUID7String)),
  commentId: Type.Optional(Nullable(UUID7String)),
})

export const adminStrikeIssueSchemaResponse = Type.Object({
  id: UUID7String,
  activeCount: Type.Number(),
  suspended: Type.Boolean(),
})

export const adminStrikeParamSchemaParam = Type.Object({
  id: UUID7String,
  strikeId: UUID7String,
})

export const adminStrikeListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      reason: Type.String(),
      postId: Nullable(UUID7String),
      commentId: Nullable(UUID7String),
      createdAt: Type.String({ format: "date-time" }),
      revokedAt: Nullable(Type.String({ format: "date-time" })),
      issuedByUsername: Nullable(Type.String()),
      revokedByUsername: Nullable(Type.String()),
      active: Type.Boolean(),
    }),
  ),
  activeCount: Type.Number(),
})

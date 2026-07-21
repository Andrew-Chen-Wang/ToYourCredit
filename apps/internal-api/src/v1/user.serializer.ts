import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const userMeSchemaResponse = Type.Object({
  id: UUID7String,
  username: Type.String(),
  usernameChangedAt: Nullable(Type.String({ format: "date-time" })),
  displayName: Nullable(Type.String()),
  about: Nullable(Type.String()),
  avatarImageKey: Nullable(Type.String()),
  bannerImageKey: Nullable(Type.String()),
  postKarma: Type.Number(),
  commentKarma: Type.Number(),
  createdAt: Type.String({ format: "date-time" }),
  email: Type.String(),
  isAdmin: Type.Boolean(),
})

export const userPublicSchemaResponse = Type.Object({
  id: UUID7String,
  username: Type.String(),
  displayName: Nullable(Type.String()),
  about: Nullable(Type.String()),
  avatarImageKey: Nullable(Type.String()),
  bannerImageKey: Nullable(Type.String()),
  postKarma: Type.Number(),
  commentKarma: Type.Number(),
  createdAt: Type.String({ format: "date-time" }),
  strikeCount: Type.Number(),
})

export const userStrikesSchemaQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
})

export const userStrikesSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      reason: Type.String(),
      createdAt: Type.String({ format: "date-time" }),
      active: Type.Boolean(),
      contentHidden: Type.Boolean(),
      post: Nullable(
        Type.Object({
          id: UUID7String,
          title: Nullable(Type.String()),
          bodyMd: Nullable(Type.String()),
          communityId: Nullable(UUID7String),
          communityName: Nullable(Type.String()),
          removed: Type.Boolean(),
        }),
      ),
      comment: Nullable(
        Type.Object({
          id: UUID7String,
          bodyMd: Nullable(Type.String()),
          postId: Nullable(UUID7String),
          postTitle: Nullable(Type.String()),
          communityId: Nullable(UUID7String),
          communityName: Nullable(Type.String()),
          removed: Type.Boolean(),
        }),
      ),
    }),
  ),
  activeCount: Type.Number(),
  nextCursor: Nullable(Type.String()),
})

export const userMeStrikesSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      reason: Type.String(),
      createdAt: Type.String({ format: "date-time" }),
      active: Type.Boolean(),
    }),
  ),
  activeCount: Type.Number(),
})

export const userUpdateSchemaRequest = Type.Object({
  displayName: Type.Optional(Nullable(Type.String({ maxLength: 30 }))),
  about: Type.Optional(Nullable(Type.String({ maxLength: 200 }))),
})

export const usernameAvailableSchemaQuery = Type.Object({
  username: Type.String({ minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_-]+$" }),
})

export const usernameAvailableSchemaResponse = Type.Object({
  available: Type.Boolean(),
})

export const userByUsernameSchemaParam = Type.Object({
  username: Type.String(),
})

export const userSocialLinksSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      platform: Type.String(),
      url: Type.String(),
      label: Nullable(Type.String()),
      position: Type.Number(),
    }),
  ),
})

export const userSocialLinkCreateSchemaRequest = Type.Object({
  platform: Type.String({ minLength: 1, maxLength: 40 }),
  url: Type.String({ minLength: 1, maxLength: 2000 }),
  label: Type.Optional(Nullable(Type.String({ maxLength: 60 }))),
  position: Type.Optional(Type.Number({ minimum: 0, multipleOf: 1 })),
})

export const userSocialLinkCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

export const userModeratingSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      iconImageKey: Nullable(Type.String()),
      memberCount: Type.Number(),
    }),
  ),
})

export const usernameChangeSchemaRequest = Type.Object({
  username: Type.String({ minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_-]+$" }),
})

export const usernameChangeSchemaResponse = Type.Object({
  username: Type.String(),
})

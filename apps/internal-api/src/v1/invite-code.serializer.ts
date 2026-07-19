import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const inviteCodeSchemaParam = Type.Object({
  id: UUID7String,
})

export const inviteCodeNicknameSchemaRequest = Type.Object({
  nickname: Type.String({ minLength: 1, maxLength: 50 }),
})

const inviteCodeSchema = Type.Object({
  id: UUID7String,
  code: Type.String(),
  status: Type.Union([Type.Literal("active"), Type.Literal("used"), Type.Literal("revoked")]),
  createdAt: Type.String({ format: "date-time" }),
  usedAt: Nullable(Type.String({ format: "date-time" })),
  referral: Nullable(
    Type.Object({
      userId: UUID7String,
      username: Type.String(),
      displayName: Nullable(Type.String()),
      avatarImageKey: Nullable(Type.String()),
      nickname: Type.String(),
    }),
  ),
})

export const inviteCodeCreateSchemaResponse = Type.Object({
  id: UUID7String,
  code: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
})

export const inviteCodeListSchemaResponse = Type.Object({
  data: Type.Array(inviteCodeSchema),
  activeCount: Type.Number(),
  totalCount: Type.Number(),
  maxActive: Type.Number(),
  maxTotal: Type.Number(),
})

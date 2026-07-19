import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const adminInviteCodeCreateSchemaResponse = Type.Object({
  id: UUID7String,
  code: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
})

export const adminInviteCodeListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      code: Type.String(),
      createdAt: Type.String({ format: "date-time" }),
      usedAt: Nullable(Type.String({ format: "date-time" })),
      revokedAt: Nullable(Type.String({ format: "date-time" })),
      createdByUsername: Type.String(),
      usedByUsername: Nullable(Type.String()),
    }),
  ),
})

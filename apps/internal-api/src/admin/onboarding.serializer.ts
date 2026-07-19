import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const adminOnboardingSchemaQuery = Type.Object({
  status: Type.Optional(
    Type.Union([Type.Literal("pending"), Type.Literal("approved"), Type.Literal("rejected")]),
  ),
  cursor: Type.Optional(Type.String()),
})

export const adminOnboardingRejectSchemaRequest = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 1000 }),
})

export const adminOnboardingSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      status: Type.String(),
      profileLink: Type.String(),
      opinionLink: Type.String(),
      criticalThinkingLink: Type.String(),
      acceptWrongLink: Type.String(),
      rejectionReason: Nullable(Type.String()),
      submittedAt: Type.String({ format: "date-time" }),
      reviewedAt: Nullable(Type.String({ format: "date-time" })),
      applicant: Type.Object({
        id: UUID7String,
        username: Type.String(),
        email: Type.String(),
        createdAt: Type.String({ format: "date-time" }),
      }),
      inviter: Nullable(
        Type.Object({
          id: UUID7String,
          username: Type.String(),
        }),
      ),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})

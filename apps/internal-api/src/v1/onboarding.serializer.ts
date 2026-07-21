import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const link = Type.String({ pattern: "^https?://\\S+$", minLength: 8, maxLength: 2000 })

export const onboardingSchemaRequest = Type.Object({
  inviteCode: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  profileLink: Type.Optional(link),
  opinionLink: Type.Optional(link),
  criticalThinkingLink: Type.Optional(link),
  acceptWrongLink: Type.Optional(link),
})

export const onboardingCheckCodeSchemaRequest = Type.Object({
  inviteCode: Type.String({ minLength: 1, maxLength: 50 }),
})

export const onboardingCheckCodeSchemaResponse = Type.Object({
  valid: Type.Boolean(),
  superuser: Type.Boolean(),
})

export const onboardingUsernameSchemaRequest = Type.Object({
  username: Type.String({ minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_-]+$" }),
})

export const onboardingUsernameSchemaResponse = Type.Object({
  username: Type.String(),
})

export const onboardingUpdateSchemaRequest = Type.Object({
  profileLink: link,
  opinionLink: link,
  criticalThinkingLink: link,
  acceptWrongLink: link,
})

export const onboardingApplicationSchema = Type.Object({
  id: UUID7String,
  status: Type.String(),
  profileLink: Type.String(),
  opinionLink: Type.String(),
  criticalThinkingLink: Type.String(),
  acceptWrongLink: Type.String(),
  rejectionReason: Nullable(Type.String()),
  submittedAt: Type.String({ format: "date-time" }),
  reviewedAt: Nullable(Type.String({ format: "date-time" })),
})

export const onboardingSchemaResponse = Type.Object({
  application: Nullable(onboardingApplicationSchema),
  superuser: Type.Boolean(),
})

export const onboardingMeSchemaResponse = Type.Object({
  application: Nullable(onboardingApplicationSchema),
})

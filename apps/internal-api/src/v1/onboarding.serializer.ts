import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const link = Type.String({ pattern: "^https?://\\S+$", minLength: 8, maxLength: 2000 })

export const onboardingSchemaRequest = Type.Object({
  inviteCode: Type.String({ minLength: 1, maxLength: 50 }),
  profileLink: link,
  opinionLink: link,
  criticalThinkingLink: link,
  acceptWrongLink: link,
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
  application: onboardingApplicationSchema,
})

export const onboardingMeSchemaResponse = Type.Object({
  application: Nullable(onboardingApplicationSchema),
})

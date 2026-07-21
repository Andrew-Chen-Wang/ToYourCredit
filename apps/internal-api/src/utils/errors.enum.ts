/**
 * Standard error codes for API responses
 * These codes are used in the "code" field of error responses
 */
export enum ErrorCode {
  // General errors
  BadRequest = "BadRequest",
  Unauthenticated = "Unauthenticated",
  Unauthorized = "Unauthorized",
  Forbidden = "Forbidden",
  NotFound = "NotFound",
  MethodNotAllowed = "MethodNotAllowed",
  Conflict = "Conflict",
  UnprocessableEntity = "UnprocessableEntity",
  TooManyRequests = "TooManyRequests",
  InternalServerError = "InternalServerError",
  ServiceUnavailable = "ServiceUnavailable",

  // Authentication/Authorization errors
  InsufficientPermissions = "InsufficientPermissions",
  Suspended = "Suspended",
  NotVerified = "NotVerified",

  // Onboarding errors
  InviteCodeInvalid = "InviteCodeInvalid",
  InviteCodeLimitReached = "InviteCodeLimitReached",
  AlreadySubmitted = "AlreadySubmitted",

  // Validation errors
  ValidationFailed = "ValidationFailed",
  InvalidInput = "InvalidInput",
  MissingRequiredField = "MissingRequiredField",

  // Resource errors
  ResourceNotFound = "ResourceNotFound",
  ResourceAlreadyExists = "ResourceAlreadyExists",
  ResourceLocked = "ResourceLocked",

  // Business logic errors
  OperationFailed = "OperationFailed",
  ContentStriked = "ContentStriked",

  // Data errors
  DataIntegrityViolation = "DataIntegrityViolation",

  // Rate limiting
  RateLimitExceeded = "RateLimitExceeded",

  // Custom application errors - defined by developer
  // Format: CustomError_<name>
  // ------------------------------------------------
}

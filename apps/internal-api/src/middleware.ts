import { authUser } from "@lib/dao"
import { sha256 } from "@oslojs/crypto/sha2"
import { encodeHexLowerCase } from "@oslojs/encoding"
import type { DB } from "@template-nextjs/db"
import { db } from "@template-nextjs/db"
import type { Context } from "hono"
import { getCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import type { Selectable } from "kysely"
import { ErrorCode } from "./utils/errors.enum"
import { throwHTTPException } from "./utils/http-exception"

type SessionUser = Pick<
  Selectable<DB["user"]>,
  "id" | "isAdmin" | "name" | "email" | "suspendedAt" | "verificationStatus"
>

export async function getSession(
  c:
    | Context<{ Variables: { user: SessionUser; session: Selectable<DB["session"]> } }, string>
    | Context<
        { Variables: { user: SessionUser | null; session: Selectable<DB["session"]> | null } },
        string
      >,
) {
  const sessionToken = getCookie(c, "session")
  if (!sessionToken) {
    throwHTTPException(401, ErrorCode.Unauthenticated, "Unauthenticated")
  }

  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(sessionToken)))
  let session: Awaited<ReturnType<ReturnType<typeof authUser>["validateSessionToken"]>>
  try {
    session = await authUser(db).validateSessionToken(sessionId)
  } catch {
    // Typically this means we're unable to connect to the database
    return throwHTTPException(503, ErrorCode.ServiceUnavailable, "Service unavailable")
  }
  if (!session) throwHTTPException(401, ErrorCode.Unauthenticated, "Unauthenticated")
  if (session.user.suspendedAt) {
    throwHTTPException(403, ErrorCode.Suspended, "Account suspended")
  }
  return session
}

export const authMiddleware = createMiddleware<{
  Variables: {
    user: SessionUser
    session: Selectable<DB["session"]>
  }
}>(async (c, next) => {
  const session = await getSession(c)
  c.set("user", session.user)
  c.set("session", session.session)

  await next()
})

/**
 * Like authMiddleware, but additionally requires the account to have completed
 * onboarding (verification_status = 'verified'). Unverified users may only
 * read and save content; every other write goes through this middleware.
 */
export const verifiedMiddleware = createMiddleware<{
  Variables: {
    user: SessionUser
    session: Selectable<DB["session"]>
  }
}>(async (c, next) => {
  // Reuse the session when chained after authMiddleware to avoid a second lookup.
  const existingUser = c.var.user as SessionUser | undefined
  const existingSession = c.var.session as Selectable<DB["session"]> | undefined
  const { user, session } =
    existingUser && existingSession
      ? { user: existingUser, session: existingSession }
      : await getSession(c)
  if (user.verificationStatus !== "verified" && !user.isAdmin) {
    throwHTTPException(403, ErrorCode.NotVerified, "Account not verified")
  }
  c.set("user", user)
  c.set("session", session)

  await next()
})

export const authNoThrowMiddleware = createMiddleware<{
  Variables: {
    user: SessionUser | null
    session: Selectable<DB["session"]> | null
  }
}>(async (c, next) => {
  try {
    const session = await getSession(c)
    c.set("user", session.user)
    c.set("session", session.session)
  } catch (e) {
    if (e instanceof HTTPException && e.status === 401) {
      c.set("user", null)
      c.set("session", null)
    } else {
      throw e
    }
  }

  await next()
})

import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import { describeRoute } from "hono-typebox-openapi"
import { resolver } from "hono-typebox-openapi/typebox"
import { Type } from "typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse, Nullable } from "../utils/common.serializer"

const AuthMeResponseT = Type.Object({
  user: Nullable(
    Type.Object({
      id: Type.String(),
      name: Nullable(Type.String()),
      email: Type.String(),
      isAdmin: Type.Boolean(),
      verificationStatus: Type.Union([
        Type.Literal("unverified"),
        Type.Literal("pending"),
        Type.Literal("verified"),
        Type.Literal("rejected"),
      ]),
    }),
  ),
})

const app = new Hono()
  .get(
    "/me",
    authNoThrowMiddleware,
    describeRoute({
      responses: {
        200: {
          description: "Current authenticated user or null",
          content: {
            "application/json": {
              schema: resolver(AuthMeResponseT),
            },
          },
        },
      },
    }),
    (c) => {
      const user = c.var.user
      return c.json({ user: user ?? null }, 200)
    },
  )
  .use(authMiddleware)
  .post(
    "/logout",
    describeRoute({
      responses: {
        200: {
          description: "Successfully logged out",
          content: {
            "application/json": {
              schema: resolver(EmptyObject),
            },
          },
        },
        500: {
          description: "",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    async (c) => {
      const session = c.var.session
      await db.deleteFrom("session").where("sessionKey", "=", session.sessionKey).execute()
      deleteCookie(c, "session", {
        path: "/",
        // Must match the domain the website sets in prod (`.toyourcredit.forum`)
        // or the browser keeps the cookie.
        domain:
          process.env.NODE_ENV === "development"
            ? undefined
            : `.${process.env.NEXT_PUBLIC_HOSTNAME}`,
      })
      return c.json({}, 200)
    },
  )

export default app

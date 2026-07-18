import { Hono } from "hono"
import { cors } from "hono/cors"

/** Flipped by the SIGTERM handler so Traefik drops this instance from rotation
 *  (health returns 503) before websockets are drained during blue/green deploys. */
export const lifecycle = { draining: false }

export const app = new Hono().basePath("/api")

app.use(
  cors({
    origin: (origin) => {
      if (!origin) return null
      let hostname: string
      try {
        hostname = new URL(origin).hostname
      } catch {
        return null
      }
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "toyourcredit.forum" ||
        hostname.endsWith(".toyourcredit.forum")
      ) {
        return origin
      }
      return null
    },
    credentials: true,
  }),
)

app.get("/health", (c) => {
  if (lifecycle.draining) return c.json({ status: "draining" }, 503)
  return c.json({ status: "ok" })
})

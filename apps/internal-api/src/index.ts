import { serve } from "@hono/node-server"
import { Scalar } from "@scalar/hono-api-reference"
import { generateSpecs, type OpenApiSpecsOptions, openAPISpecs } from "hono-typebox-openapi"
import { app, lifecycle } from "./app"
import { subscribeChatEvents } from "./realtime"
import { ErrorObjectT, ErrorResponseT, InnerErrorT } from "./utils/errors/error.serializer"
import v1 from "./v1"
import admin from "./admin"
import { drainSockets, nodeWebSocket, sendToUsers } from "./ws"

const spec: OpenApiSpecsOptions = {
  documentation: {
    info: {
      title: "Internal API",
      version: "1.0.0",
      description: "Internal API",
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
        description: "Local Server",
      },
    ],
    components: {
      schemas: {
        InnerErrorT,
        ErrorObjectT,
        ErrorResponseT,
      },
    },
  },
}

if (process.env.NODE_ENV === "development") {
  app.get(
    "/openapi",
    openAPISpecs(app, {
      ...spec,
      exclude: /^\/api\/admin(?:\/|$).*/,
    }),
  )
  app.get(
    "/admin-openapi",
    openAPISpecs(app, {
      ...spec,
      exclude: /^(?!\/api\/admin(?:\/|$)).*/,
    }),
  )
  app.get(
    "/docs",
    Scalar(() => {
      return {
        url: "/api/openapi",
        theme: "saturn",
      }
    }),
  )
  app.get(
    "/admin-docs",
    Scalar(() => {
      return {
        url: "/api/admin-openapi",
        theme: "saturn",
      }
    }),
  )
}

const routes = app.route("", v1).route("", admin)

export default app
export type AppType = typeof routes

if (process.argv.includes("--openapi")) {
  generateSpecs(app, spec)
    .then((specs) => {
      console.log(JSON.stringify(specs, null, 2))
      // BullMQ queues imported by routes hold Valkey connections that keep the
      // event loop alive, so the CLI must exit explicitly.
      process.exit(0)
    })
    .catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
} else {
  const server = serve({ fetch: app.fetch, port: Number(process.env.API_PORT) || 3001 }, (info) => {
    console.log(`Listening on http://localhost:${info.port}`)
  })
  nodeWebSocket.injectWebSocket(server)

  // Fan chat events (from this or the other blue/green instance) out to the
  // websockets connected here.
  subscribeChatEvents((event) => {
    sendToUsers(event.userIds, event)
  })

  // Blue/green drain: fail health checks so Traefik pulls this instance from
  // rotation, hand websocket clients off to the replacement, finish in-flight
  // requests, then exit — all inside the compose stop_grace_period (90s).
  let shuttingDown = false
  function shutdown(signal: NodeJS.Signals) {
    if (shuttingDown) return
    shuttingDown = true
    lifecycle.draining = true
    const timeout = setTimeout(() => {
      console.error(`${signal} shutdown timed out`)
      process.exit(1)
    }, 80_000)
    timeout.unref()
    async function close() {
      // Two Traefik health-check intervals (5s each) so no new traffic arrives.
      await new Promise((resolve) => setTimeout(resolve, 11_000))
      await drainSockets()
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      })
      clearTimeout(timeout)
      process.exit(0)
    }
    close().catch(() => process.exit(1))
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

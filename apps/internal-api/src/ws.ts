import { createNodeWebSocket } from "@hono/node-ws"
import type { WSContext } from "hono/ws"
import { app } from "./app"

export const nodeWebSocket = createNodeWebSocket({ app })

/** Live sockets per user on this instance. Fan-out across instances happens via
 *  the Valkey pub/sub bridge in `realtime.ts`, not this map. */
const sockets = new Map<string, Set<WSContext>>()

export function registerSocket(userId: string, ws: WSContext): void {
  let set = sockets.get(userId)
  if (!set) {
    set = new Set()
    sockets.set(userId, set)
  }
  set.add(ws)
}

export function unregisterSocket(userId: string, ws: WSContext): void {
  const set = sockets.get(userId)
  if (!set) return
  set.delete(ws)
  if (set.size === 0) sockets.delete(userId)
}

export function sendToUsers(userIds: readonly string[], payload: unknown): void {
  const message = JSON.stringify(payload)
  for (const userId of userIds) {
    const set = sockets.get(userId)
    if (!set) continue
    for (const ws of set) {
      try {
        ws.send(message)
      } catch {
        // Socket already closing; the close handler unregisters it.
      }
    }
  }
}

/** Close every socket with 1001 (going away), staggered so reconnecting clients
 *  don't stampede the replacement instance during a blue/green flip. */
export async function drainSockets(windowMs = 3000): Promise<void> {
  const all = [...sockets.values()].flatMap((set) => [...set])
  if (all.length === 0) return
  const notice = JSON.stringify({ type: "server:restart" })
  const step = windowMs / all.length
  for (const ws of all) {
    try {
      ws.send(notice)
      ws.close(1001, "server restarting")
    } catch {
      // Already closed.
    }
    await new Promise((resolve) => setTimeout(resolve, step))
  }
}

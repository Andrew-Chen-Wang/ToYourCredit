import { Redis } from "ioredis"

/** Chat events fan out through Valkey pub/sub rather than in-process emit so
 *  they reach sockets on both instances during blue/green deploy overlap. */
const CHANNEL = "chat:events"

export type ChatEventType = "message:new" | "message:deleted" | "conversation:updated"

export type ChatEvent = {
  type: ChatEventType
  conversationId: string
  /** Participants who should receive the event. */
  userIds: string[]
  data?: unknown
}

const valkeyUrl = () => process.env.VALKEY_URL ?? "redis://localhost:6379"

let publisher: Redis | null = null

export function publishChatEvent(event: ChatEvent): void {
  publisher ??= new Redis(valkeyUrl())
  // Fire-and-forget: a dropped realtime event only delays the UI until its
  // next reconnect/invalidation sync.
  void publisher.publish(CHANNEL, JSON.stringify(event)).catch((err: unknown) => {
    console.error("chat event publish failed", err)
  })
}

let subscriber: Redis | null = null

export function subscribeChatEvents(handler: (event: ChatEvent) => void): void {
  subscriber ??= new Redis(valkeyUrl())
  void subscriber.subscribe(CHANNEL)
  subscriber.on("message", (_channel, raw) => {
    try {
      handler(JSON.parse(raw) as ChatEvent)
    } catch (err) {
      console.error("chat event parse failed", err)
    }
  })
}

export async function closeRealtime(): Promise<void> {
  await Promise.all([publisher?.quit(), subscriber?.quit()])
  publisher = null
  subscriber = null
}

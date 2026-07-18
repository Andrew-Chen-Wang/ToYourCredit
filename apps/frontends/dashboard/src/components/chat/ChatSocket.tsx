import { useQueryClient } from "@tanstack/react-query"
import { baseUrl } from "@lib/api-client/index"
import {
  getApiV1ChatOptions,
  getApiV1ChatUnreadCountOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

/** Wire shape of a chat event published by the API (see internal-api realtime.ts).
 *  `message:new` carries the serialized message with an ISO `createdAt`. */
export type ChatSocketEvent =
  | {
      type: "message:new"
      conversationId: string
      data: {
        id: string
        conversationId: string
        senderUserId: string | null
        body: string | null
        isDeleted: boolean
        createdAt: string
      }
    }
  | { type: "message:deleted"; conversationId: string; data: { messageId: string } }
  | { type: "conversation:updated"; conversationId: string }
  | { type: "server:restart" }
  /** Synthetic client-side event fired after a reconnect so consumers can
   *  catch up on anything missed while disconnected. */
  | { type: "socket:reconnected" }

type Listener = (event: ChatSocketEvent) => void

interface ChatSocketValue {
  /** False while the websocket is down; consumers may fall back to slow polling. */
  connected: boolean
  /** Subscribe to chat events; returns an unsubscribe function. */
  subscribe: (listener: Listener) => () => void
}

const FALLBACK: ChatSocketValue = {
  connected: false,
  subscribe: () => () => {},
}

const ChatSocketContext = createContext<ChatSocketValue | null>(null)

export function useChatSocket(): ChatSocketValue {
  return useContext(ChatSocketContext) ?? FALLBACK
}

const WS_URL = `${baseUrl.replace(/^http/, "ws")}/api/v1/chat/ws`
const MAX_BACKOFF_MS = 30_000

/**
 * Maintains the chat websocket for the whole app: auto-reconnect (immediate
 * with jitter on deploy drains — close code 1001 — exponential backoff
 * otherwise), central query invalidation, and an event bus for `ChatThread`.
 */
export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef(new Set<Listener>())

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    let ws: WebSocket | null = null
    let disposed = false
    let attempts = 0
    let everConnected = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const dispatch = (event: ChatSocketEvent) => {
      for (const listener of listenersRef.current) listener(event)
    }

    const invalidateChatQueries = () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
      void queryClient.invalidateQueries({ queryKey: getApiV1ChatUnreadCountOptions().queryKey })
    }

    const connect = () => {
      if (disposed) return
      ws = new WebSocket(WS_URL)

      ws.addEventListener("open", () => {
        attempts = 0
        setConnected(true)
        if (everConnected) {
          // Catch up on anything missed while disconnected.
          dispatch({ type: "socket:reconnected" })
          invalidateChatQueries()
        }
        everConnected = true
      })

      ws.addEventListener("message", (raw: MessageEvent) => {
        let event: ChatSocketEvent
        try {
          event = JSON.parse(raw.data as string) as ChatSocketEvent
        } catch {
          return
        }
        dispatch(event)
        switch (event.type) {
          case "message:new":
          case "conversation:updated":
            invalidateChatQueries()
            break
          case "message:deleted":
            void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
            break
          default:
            break
        }
      })

      ws.addEventListener("close", (event: CloseEvent) => {
        setConnected(false)
        if (disposed) return
        // 1001 = deploy drain: the replacement instance is already serving, so
        // reconnect immediately (jittered to avoid a stampede).
        const delay =
          event.code === 1001
            ? 200 + Math.random() * 800
            : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempts) + Math.random() * 1000
        attempts += 1
        reconnectTimer = setTimeout(connect, delay)
      })

      ws.addEventListener("error", () => {
        ws?.close()
      })
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close(1000)
    }
  }, [queryClient])

  const value = useMemo<ChatSocketValue>(() => ({ connected, subscribe }), [connected, subscribe])

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>
}

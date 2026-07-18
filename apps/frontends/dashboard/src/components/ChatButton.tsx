import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { useChatDock } from "@frontends/dashboard/components/chat/ChatDockContext"
import { useChatSocket } from "@frontends/dashboard/components/chat/ChatSocket"
import { getApiV1ChatUnreadCountOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { MessageCircle } from "lucide-react"

/**
 * TopNav entry point for chat. The unread-conversation count updates via chat
 * websocket invalidations; a slow 30s poll covers periods where the socket is
 * down. Toggles the floating chat dock when it's mounted; otherwise navigates
 * to the full `/chat` page.
 */
export function ChatButton() {
  const dock = useChatDock()
  const navigate = useNavigate()
  const { connected } = useChatSocket()
  const { data } = useQuery({
    ...getApiV1ChatUnreadCountOptions(),
    refetchInterval: connected ? false : 30_000,
    refetchIntervalInBackground: false,
  })

  const count = data?.count ?? 0

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={count > 0 ? `Chat, ${count} unread` : "Chat"}
      className="relative rounded-full"
      onClick={() => {
        if (dock.available) dock.toggle()
        else void navigate({ to: "/chat", search: { filter: "all" } })
      }}
    >
      <MessageCircle className="size-5" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  )
}

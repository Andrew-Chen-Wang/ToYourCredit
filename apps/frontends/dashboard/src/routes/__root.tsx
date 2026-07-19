import { useQuery } from "@tanstack/react-query"
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { SidebarInset, SidebarProvider, useSidebar } from "@ui/base/ui/sidebar"
import { AppSidebar } from "@frontends/dashboard/components/AppSidebar"
import { ChatDock } from "@frontends/dashboard/components/chat/ChatDock"
import { ChatDockProvider } from "@frontends/dashboard/components/chat/ChatDockContext"
import { ChatSocketProvider } from "@frontends/dashboard/components/chat/ChatSocket"
import { OnboardingModal } from "@frontends/dashboard/components/onboarding/OnboardingModal"
import { TopNav } from "@frontends/dashboard/components/TopNav"
import { getApiV1AuthMeOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Link } from "@tanstack/react-router"
import { PanelLeft } from "lucide-react"
import { useEffect } from "react"

export const Route = createRootRoute({
  component: RootLayout,
})

/** Maps the active route to a descriptive document.title, mirroring reddit's tab titles. */
function titleForRoute(routeId: string, params: Record<string, string>): string {
  const name = params.name
  const username = params.username
  switch (routeId) {
    case "/":
      return "ToYourCredit - Serious policy discussion"
    case "/popular":
      return "Popular - ToYourCredit"
    case "/explore":
      return "Explore - ToYourCredit"
    case "/submit":
      return "Create a post - ToYourCredit"
    case "/settings":
      return "Settings - ToYourCredit"
    case "/notifications":
      return "Notifications - ToYourCredit"
    case "/search":
      return "Search - ToYourCredit"
    case "/chat":
      return "Chat - ToYourCredit"
    case "/profile":
      return "Profile - ToYourCredit"
  }
  if (routeId.startsWith("/mod/")) return name ? `Mod - r/${name}` : "Mod Tools - ToYourCredit"
  if (routeId.startsWith("/r_/") && routeId.includes("comments")) {
    return name ? `Post - r/${name}` : "Post - ToYourCredit"
  }
  if (routeId.startsWith("/r_/") && routeId.includes("submit")) {
    return name ? `Create a post - r/${name}` : "Create a post - ToYourCredit"
  }
  if (routeId.startsWith("/r/") || routeId.startsWith("/r_/")) {
    return name ? `r/${name}` : "ToYourCredit"
  }
  if (routeId.startsWith("/user/")) return username ? `u/${username}` : "ToYourCredit"
  if (routeId.startsWith("/feed/")) return username ? `Feed - u/${username}` : "ToYourCredit"
  return "ToYourCredit"
}

function useDocumentTitle() {
  const { routeId, params } = useRouterState({
    select: (s) => {
      const last = s.matches[s.matches.length - 1]
      return {
        routeId: last?.routeId ?? "/",
        params: last?.params ?? {},
      }
    },
  })
  useEffect(() => {
    document.title = titleForRoute(routeId, params)
  }, [routeId, params])
}

/**
 * Collapse/expand toggle that lives in the divider between the sidebar and the
 * main content (reddit-style). Only shown at large widths; below `lg` the
 * sidebar is an offcanvas drawer toggled from the top-nav hamburger instead.
 */
function SidebarCollapseButton() {
  const { toggleSidebar, state } = useSidebar()
  return (
    <button
      type="button"
      aria-label={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
      title={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
      onClick={toggleSidebar}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "absolute left-2 top-2 z-30 hidden size-8 rounded-full border bg-background shadow-sm lg:flex",
      )}
    >
      <PanelLeft className="size-4" />
    </button>
  )
}

function RootLayout() {
  const { data, isLoading, isError } = useQuery(getApiV1AuthMeOptions())
  useDocumentTitle()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (isError || !data?.user) {
    window.location.href = `${import.meta.env.VITE_NEXTJS_URL ?? ""}/login?next=${window.location.pathname}`
    return null
  }

  const verificationStatus = data.user.verificationStatus

  return (
    <ChatSocketProvider>
      <ChatDockProvider>
        <SidebarProvider className="flex min-h-screen w-full flex-col">
          <TopNav />
          {verificationStatus === "rejected" ? (
            <div className="border-b bg-destructive/10 px-4 py-2 text-center text-sm">
              Your membership application was rejected.{" "}
              <Link
                to="/settings"
                search={{ tab: "verification" }}
                className="font-semibold underline"
              >
                Review and resubmit
              </Link>
            </div>
          ) : null}
          {verificationStatus === "pending" ? (
            <div className="border-b bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
              Your membership application is awaiting review. You can read and save content in the
              meantime.
            </div>
          ) : null}
          <div className="flex min-h-0 w-full flex-1">
            <AppSidebar />
            <SidebarInset className="min-w-0">
              <SidebarCollapseButton />
              <Outlet />
            </SidebarInset>
          </div>
        </SidebarProvider>
        {verificationStatus === "unverified" ? <OnboardingModal /> : null}
        <ChatDock />
      </ChatDockProvider>
    </ChatSocketProvider>
  )
}

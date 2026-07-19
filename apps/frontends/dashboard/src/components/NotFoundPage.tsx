import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { Compass, Home } from "lucide-react"

/**
 * Branded 404 for unmatched SPA routes (the router's defaultNotFoundComponent).
 * Mirrors the website's app/not-found.tsx so authed and anon users see the
 * same page instead of TanStack's bare "Not Found" text.
 */
export function NotFoundPage() {
  return (
    <main className="flex min-h-[70svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-bold tracking-tight text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">This page could not be found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you're looking for doesn't exist, may have been removed, or the community may be
        private.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link to="/" className={cn(buttonVariants(), "gap-1.5")}>
          <Home className="size-4" />
          Go home
        </Link>
        <Link to="/explore" className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
          <Compass className="size-4" />
          Explore communities
        </Link>
      </div>
    </main>
  )
}

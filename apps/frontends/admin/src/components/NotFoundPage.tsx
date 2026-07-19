import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"

/** Branded 404 for unmatched admin routes. */
export function NotFoundPage() {
  return (
    <main className="flex min-h-[70svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-bold tracking-tight text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">This page could not be found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        There's no admin page at this address.
      </p>
      <Link to="/" className={buttonVariants()}>
        Back to overview
      </Link>
    </main>
  )
}

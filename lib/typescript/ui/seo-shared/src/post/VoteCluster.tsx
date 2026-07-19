"use client"

import type { ReactNode } from "react"
import { ArrowBigDown, Coins } from "lucide-react"
import { cn } from "@ui/base/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@ui/base/ui/dropdown-menu"
import { formatCompactNumber } from "@ui/seo-shared/format-number"

export type VoteValue = -1 | 0 | 1

/**
 * Optional richer behavior for the credit/downvote cluster. Without it the
 * cluster degrades to two plain buttons (`onUpvote`/`onDownvote`) — the mode the
 * anon SSR site uses to route clicks to the login prompt.
 */
export type VoteClusterExtras = {
  /** Number of users who gave credit; shown on hover over the count. */
  ups?: number
  /** Press the count to open the public list of users who gave credit. */
  onShowUpvoters?: () => void
  /** Downvote dropdown content (a DownvoteMenu). Turns the down arrow into a menu trigger. */
  downvoteMenu?: ReactNode
  /** Fires when the downvote menu opens/closes — used to lazily fetch the summary. */
  onDownvoteMenuOpenChange?: (open: boolean) => void
}

export type VoteClusterProps = {
  score: number
  userVote: number
  onUpvote: () => void
  onDownvote: () => void
  disabled?: boolean
  orientation?: "vertical" | "horizontal"
  size?: "sm" | "md"
  /**
   * `pill` (default): rounded background capsule used in feeds/post headers.
   * `plain`: no capsule background — bare inline controls + count, used inline in
   * the comment action row (Reddit comment style). Hover tint is per-button.
   */
  variant?: "pill" | "plain"
  extras?: VoteClusterExtras
}

/**
 * ToYourCredit vote cluster: a coin ("credit") instead of an upvote arrow, and a
 * categorized downvote dropdown instead of a bare downvote. The active direction
 * is tinted (credit amber, downvote violet). Purely presentational — the caller
 * owns vote state; `onUpvote` toggles credit, and the downvote either opens the
 * supplied `extras.downvoteMenu` or falls back to `onDownvote` (anon SSR login
 * prompt). Shared between SSR and SPA.
 */
export function VoteCluster({
  score,
  userVote,
  onUpvote,
  onDownvote,
  disabled = false,
  orientation = "horizontal",
  size = "md",
  variant = "pill",
  extras,
}: VoteClusterProps) {
  const upActive = userVote > 0
  const downActive = userVote < 0
  const active = upActive || downActive
  const iconSize = size === "sm" ? "size-4" : "size-5"
  const scoreText = size === "sm" ? "text-xs" : "text-sm"
  const plain = variant === "plain"
  // The pill fills amber (credit) / periwinkle (downvote) and turns its contents
  // white when voted. The plain (comment) variant has no capsule, only text tint.
  const pillFilled = !plain && active

  const downButton = (
    <button
      type="button"
      aria-label="Downvote with a reason"
      aria-pressed={downActive}
      disabled={disabled}
      onClick={extras?.downvoteMenu ? undefined : onDownvote}
      className={cn(
        "flex items-center justify-center rounded-full p-1 transition-colors disabled:pointer-events-none",
        plain && "hover:bg-violet-500/10",
        pillFilled
          ? "text-white"
          : cn("hover:text-violet-500", downActive ? "text-violet-500" : "text-muted-foreground"),
      )}
    >
      <ArrowBigDown className={cn(iconSize, downActive && "fill-current")} />
    </button>
  )

  const countLabel = score === 0 && !active ? "Credit" : formatCompactNumber(score)
  const countClass = cn(
    "select-none text-center font-semibold tabular-nums",
    plain ? "min-w-4 px-0.5" : "min-w-8",
    scoreText,
    pillFilled
      ? "text-white"
      : cn(
          upActive && "text-amber-600 dark:text-amber-500",
          downActive && "text-violet-500",
          !active && "text-foreground",
        ),
  )
  const upsTitle =
    extras?.ups !== undefined
      ? `${formatCompactNumber(extras.ups)} ${extras.ups === 1 ? "person" : "people"} gave credit`
      : undefined

  return (
    <div
      className={cn(
        "inline-flex items-center",
        orientation === "vertical" ? "flex-col" : "flex-row",
        plain
          ? "gap-0.5"
          : cn("rounded-full bg-muted", upActive && "bg-amber-600", downActive && "bg-[#6a5cff]"),
      )}
      data-orientation={orientation}
    >
      <button
        type="button"
        aria-label="Give credit"
        aria-pressed={upActive}
        disabled={disabled}
        onClick={onUpvote}
        className={cn(
          "flex items-center justify-center rounded-full p-1 transition-colors disabled:pointer-events-none",
          plain && "hover:bg-amber-500/10",
          pillFilled
            ? "text-white"
            : cn(
                "hover:text-amber-600 dark:hover:text-amber-500",
                upActive ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground",
              ),
        )}
      >
        <Coins className={cn(iconSize)} />
      </button>
      {extras?.onShowUpvoters ? (
        <button
          type="button"
          title={upsTitle}
          aria-label={upsTitle ?? "Show who gave credit"}
          disabled={disabled}
          onClick={extras.onShowUpvoters}
          className={cn(countClass, "hover:underline disabled:pointer-events-none")}
        >
          {countLabel}
        </button>
      ) : (
        <span title={upsTitle} className={countClass}>
          {countLabel}
        </span>
      )}
      {extras?.downvoteMenu ? (
        <DropdownMenu onOpenChange={extras.onDownvoteMenuOpenChange}>
          <DropdownMenuTrigger render={downButton} />
          <DropdownMenuContent align="start" className="w-64">
            {extras.downvoteMenu}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        downButton
      )}
    </div>
  )
}

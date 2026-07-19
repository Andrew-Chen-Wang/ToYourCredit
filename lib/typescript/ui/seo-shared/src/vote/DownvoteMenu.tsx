"use client"

import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@ui/base/ui/dropdown-menu"
import {
  DOWNVOTE_CATEGORY_LABELS,
  SELECTABLE_DOWNVOTE_CATEGORIES,
  type SelectableDownvoteCategory,
} from "@ui/seo-shared/vote/downvoteCategories"

export type DownvoteMenuProps = {
  /** Categories the current user has selected on this post/comment. */
  selected: string[]
  /** Per-category downvoter counts; null while the lazy fetch is in flight. */
  counts: Record<string, number> | null
  onToggle: (category: SelectableDownvoteCategory, checked: boolean) => void
  /** Press a count to reveal who chose that category. */
  onShowVoters?: (category: string) => void
  disabled?: boolean
}

/**
 * Content of the downvote dropdown: one checkbox row per stated reason, with a
 * public per-category count that can be pressed to reveal the downvoters.
 * Rendered inside VoteCluster's DropdownMenuContent via its `downvoteMenu` prop.
 */
export function DownvoteMenu({
  selected,
  counts,
  onToggle,
  onShowVoters,
  disabled,
}: DownvoteMenuProps) {
  const legacyCount = counts?.legacy ?? 0
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Downvote for a stated reason</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {SELECTABLE_DOWNVOTE_CATEGORIES.map((category) => {
        const count = counts?.[category] ?? 0
        return (
          <DropdownMenuCheckboxItem
            key={category}
            checked={selected.includes(category)}
            disabled={disabled}
            // Keep the menu open so several reasons can be picked in one visit.
            onSelect={(event) => {
              event.preventDefault()
            }}
            onCheckedChange={(checked) => {
              onToggle(category, checked)
            }}
            className="pr-2"
          >
            <span className="flex-1">{DOWNVOTE_CATEGORY_LABELS[category]}</span>
            {count > 0 ? (
              <button
                type="button"
                aria-label={`Show who chose ${DOWNVOTE_CATEGORY_LABELS[category]}`}
                className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onShowVoters?.(category)
                }}
              >
                {count}
              </button>
            ) : (
              <span className="ml-2 px-1.5 text-xs tabular-nums text-muted-foreground/50">0</span>
            )}
          </DropdownMenuCheckboxItem>
        )
      })}
      {legacyCount > 0 ? (
        <>
          <DropdownMenuSeparator />
          <div className="flex items-center px-2 py-1.5 text-sm text-muted-foreground">
            <span className="flex-1">{DOWNVOTE_CATEGORY_LABELS.legacy}</span>
            <button
              type="button"
              aria-label="Show legacy downvoters"
              className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums hover:bg-muted/70 hover:text-foreground"
              onClick={() => onShowVoters?.("legacy")}
            >
              {legacyCount}
            </button>
          </div>
        </>
      ) : null}
    </DropdownMenuGroup>
  )
}

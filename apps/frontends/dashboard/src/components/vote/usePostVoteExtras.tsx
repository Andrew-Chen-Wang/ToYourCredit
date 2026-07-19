import { useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getApiV1PostVoteByPostIdDownvoteSummary,
  getApiV1PostVoteByPostIdDownvoters,
  getApiV1PostVoteByPostIdUpvoters,
} from "@lib/api-client/generated/sdk.gen"
import type { VoteClusterExtras } from "@ui/seo-shared/post/VoteCluster"
import { DownvoteMenu } from "@ui/seo-shared/vote/DownvoteMenu"
import {
  DOWNVOTE_CATEGORY_LABELS,
  type SelectableDownvoteCategory,
} from "@ui/seo-shared/vote/downvoteCategories"
import { VoterListDialog } from "@ui/seo-shared/vote/VoterListDialog"

export type VoteInput = { credit: boolean } | { downvoteCategories: SelectableDownvoteCategory[] }

/** The vote value {1,0,-1} a credit/categorized-downvote input resolves to. */
export function voteInputValue(input: VoteInput): 1 | 0 | -1 {
  if ("credit" in input) return input.credit ? 1 : 0
  return input.downvoteCategories.length > 0 ? -1 : 0
}

export type UsePostVoteExtrasOptions = {
  postId: string
  userVote: number
  /** Distinct upvoter count, shown on hover; omit if the surface lacks it. */
  ups?: number
  /** Cast the vote: the surface owns the mutation + optimistic cache update. */
  onCastVote: (input: VoteInput) => void
}

export function postDownvoteSummaryKey(postId: string): unknown[] {
  return ["post-downvote-summary", postId]
}

/**
 * Wires a post's VoteCluster to the credit/categorized-downvote system: lazily
 * fetches the per-category summary when the dropdown opens, tracks the user's
 * category set optimistically, and hosts the public voter-list dialogs.
 */
export function usePostVoteExtras({
  postId,
  userVote,
  ups,
  onCastVote,
}: UsePostVoteExtrasOptions): {
  extras: VoteClusterExtras
  onUpvote: () => void
  dialogs: ReactNode
} {
  const queryClient = useQueryClient()
  const [menuOpened, setMenuOpened] = useState(false)
  const [localCategories, setLocalCategories] = useState<SelectableDownvoteCategory[] | null>(null)
  const [voterList, setVoterList] = useState<
    { kind: "up" } | { kind: "down"; category?: string } | null
  >(null)

  const summary = useQuery({
    queryKey: postDownvoteSummaryKey(postId),
    queryFn: () =>
      getApiV1PostVoteByPostIdDownvoteSummary({ path: { postId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    enabled: menuOpened,
    staleTime: 15_000,
  })

  const selected =
    localCategories ??
    (userVote === -1 ? ((summary.data?.myCategories ?? []) as SelectableDownvoteCategory[]) : [])

  function toggleCategory(category: SelectableDownvoteCategory, checked: boolean) {
    const next = checked
      ? [...selected.filter((c) => c !== category), category]
      : selected.filter((c) => c !== category)
    setLocalCategories(next)
    onCastVote({ downvoteCategories: next })
    void queryClient.invalidateQueries({ queryKey: postDownvoteSummaryKey(postId) })
  }

  function onUpvote() {
    setLocalCategories([])
    onCastVote({ credit: userVote !== 1 })
    void queryClient.invalidateQueries({ queryKey: postDownvoteSummaryKey(postId) })
  }

  const extras: VoteClusterExtras = {
    ups,
    onShowUpvoters: () => {
      setVoterList({ kind: "up" })
    },
    downvoteMenu: (
      <DownvoteMenu
        selected={selected}
        counts={(summary.data?.categoryCounts as Record<string, number> | undefined) ?? null}
        onToggle={toggleCategory}
        onShowVoters={(category) => {
          setVoterList({ kind: "down", category })
        }}
      />
    ),
    onDownvoteMenuOpenChange: (open) => {
      if (open) setMenuOpened(true)
    },
  }

  const dialogs = (
    <VoterListDialog
      open={voterList !== null}
      onOpenChange={(open) => {
        if (!open) setVoterList(null)
      }}
      title={
        voterList?.kind === "down"
          ? voterList.category
            ? `Downvoted: ${DOWNVOTE_CATEGORY_LABELS[voterList.category] ?? voterList.category}`
            : "Downvoted by"
          : "Credit given by"
      }
      fetchPage={(cursor) => {
        if (voterList?.kind === "down") {
          return getApiV1PostVoteByPostIdDownvoters({
            path: { postId },
            query: { cursor, category: voterList.category },
            throwOnError: true,
          }).then((r) => r.data)
        }
        return getApiV1PostVoteByPostIdUpvoters({
          path: { postId },
          query: { cursor },
          throwOnError: true,
        }).then((r) => r.data)
      }}
      userHref={(username) => `/user/${username}`}
    />
  )

  return { extras, onUpvote, dialogs }
}

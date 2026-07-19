import { useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getApiV1CommentVoteByCommentIdDownvoteSummary,
  getApiV1CommentVoteByCommentIdDownvoters,
  getApiV1CommentVoteByCommentIdUpvoters,
} from "@lib/api-client/generated/sdk.gen"
import type { VoteClusterExtras } from "@ui/seo-shared/post/VoteCluster"
import { DownvoteMenu } from "@ui/seo-shared/vote/DownvoteMenu"
import {
  DOWNVOTE_CATEGORY_LABELS,
  type SelectableDownvoteCategory,
} from "@ui/seo-shared/vote/downvoteCategories"
import { VoterListDialog } from "@ui/seo-shared/vote/VoterListDialog"
import type { VoteInput } from "./usePostVoteExtras"

export type UseCommentVoteExtrasOptions = {
  commentId: string
  userVote: number
  ups?: number
  onCastVote: (input: VoteInput) => void
}

export function commentDownvoteSummaryKey(commentId: string): unknown[] {
  return ["comment-downvote-summary", commentId]
}

/** Comment twin of usePostVoteExtras. */
export function useCommentVoteExtras({
  commentId,
  userVote,
  ups,
  onCastVote,
}: UseCommentVoteExtrasOptions): {
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
    queryKey: commentDownvoteSummaryKey(commentId),
    queryFn: () =>
      getApiV1CommentVoteByCommentIdDownvoteSummary({
        path: { commentId },
        throwOnError: true,
      }).then((r) => r.data),
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
    void queryClient.invalidateQueries({ queryKey: commentDownvoteSummaryKey(commentId) })
  }

  function onUpvote() {
    setLocalCategories([])
    onCastVote({ credit: userVote !== 1 })
    void queryClient.invalidateQueries({ queryKey: commentDownvoteSummaryKey(commentId) })
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
          return getApiV1CommentVoteByCommentIdDownvoters({
            path: { commentId },
            query: { cursor, category: voterList.category },
            throwOnError: true,
          }).then((r) => r.data)
        }
        return getApiV1CommentVoteByCommentIdUpvoters({
          path: { commentId },
          query: { cursor },
          throwOnError: true,
        }).then((r) => r.data)
      }}
      userHref={(username) => `/user/${username}`}
    />
  )

  return { extras, onUpvote, dialogs }
}

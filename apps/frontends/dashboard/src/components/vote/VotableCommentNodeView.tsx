import { createContext, useContext } from "react"
import { CommentNodeView, type CommentNodeViewProps } from "@ui/seo-shared/comment/CommentNodeView"
import type { CommentNode } from "@ui/seo-shared/comment/types"
import { useCommentVoteExtras } from "./useCommentVoteExtras"
import type { VoteInput } from "./usePostVoteExtras"

export type CommentVoteContextValue = {
  castVote: (node: CommentNode, input: VoteInput) => void
  disabled?: boolean
}

/** Supplies the comment surface's vote mutation to each VotableCommentNodeView. */
export const CommentVoteContext = createContext<CommentVoteContextValue | null>(null)

/**
 * CommentNodeView wired to the credit/categorized-downvote system. Pass as
 * `callbacks.NodeView` to CommentTree, with a CommentVoteContext provider
 * around the tree supplying the mutation.
 */
export function VotableCommentNodeView(props: CommentNodeViewProps) {
  const ctx = useContext(CommentVoteContext)
  const { extras, onUpvote, dialogs } = useCommentVoteExtras({
    commentId: props.node.id,
    userVote: props.node.userVote,
    ups: props.node.ups,
    onCastVote: (input) => ctx?.castVote(props.node, input),
  })

  if (!ctx || ctx.disabled) return <CommentNodeView {...props} />

  return (
    <>
      <CommentNodeView {...props} onUpvote={onUpvote} voteExtras={extras} />
      {dialogs}
    </>
  )
}

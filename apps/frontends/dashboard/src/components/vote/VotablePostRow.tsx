import { PostRow, type PostRowProps } from "@ui/seo-shared/post/PostRow"
import { usePostVoteExtras, type VoteInput } from "./usePostVoteExtras"

export type VotablePostRowProps = Omit<PostRowProps, "onUpvote" | "onDownvote" | "voteExtras"> & {
  /** Distinct upvoter count (post.ups) when the surface has it. */
  ups?: number
  /** Cast the vote: the surface owns the mutation + optimistic cache update. */
  onCastVote: (input: VoteInput) => void
}

/**
 * PostRow wired to the credit/categorized-downvote system: the coin toggles
 * credit, the down arrow opens the reason dropdown (summary fetched lazily),
 * and voter lists open from the counts. Cache/mutation stays with the caller
 * via `onCastVote`.
 */
export function VotablePostRow({ ups, onCastVote, ...rowProps }: VotablePostRowProps) {
  const { extras, onUpvote, dialogs } = usePostVoteExtras({
    postId: rowProps.post.id,
    userVote: rowProps.post.userVote,
    ups,
    onCastVote,
  })
  return (
    <>
      <PostRow {...rowProps} onUpvote={onUpvote} onDownvote={() => {}} voteExtras={extras} />
      {dialogs}
    </>
  )
}

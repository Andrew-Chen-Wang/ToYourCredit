import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, type ReactElement, type ReactNode } from "react"
import { LegalFooter } from "@ui/seo-shared/LegalFooter"
import { PostDetailCard } from "@ui/seo-shared/post/PostDetailCard"
import type { CommentSortValue } from "@ui/seo-shared/comment/types"
import { CommentSection } from "@frontends/dashboard/components/CommentSection"
import { PostCommentSearch } from "@frontends/dashboard/components/PostCommentSearch"
import {
  usePostVoteExtras,
  voteInputValue,
  type VoteInput,
} from "@frontends/dashboard/components/vote/usePostVoteExtras"
import { PostActionsMenu } from "@frontends/dashboard/components/PostActionsMenu"
import { PostShareMenu } from "@frontends/dashboard/components/PostShareMenu"
import { UserLinkHoverCard } from "@frontends/dashboard/components/PostHoverCards"
import { getApiV1PostByIdOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { putApiV1PostVoteByPostId } from "@lib/api-client/generated/sdk.gen"
import { toast } from "sonner"

const COMMENT_SORTS: CommentSortValue[] = ["best", "top", "new", "old", "controversial"]

function asCommentSort(value: unknown): CommentSortValue | undefined {
  return typeof value === "string" && (COMMENT_SORTS as string[]).includes(value)
    ? (value as CommentSortValue)
    : undefined
}

function wrapAuthorLink(link: ReactElement, username: string): ReactNode {
  return <UserLinkHoverCard username={username}>{link}</UserLinkHoverCard>
}

type CommentSearch = { sort?: CommentSortValue; comment?: string }

export const Route = createFileRoute("/user_/$username/comments/$")({
  validateSearch: (search: Record<string, unknown>): CommentSearch => ({
    sort: asCommentSort(search.sort),
    comment: typeof search.comment === "string" ? search.comment : undefined,
  }),
  component: ProfilePostDetailPage,
})

type PostData = NonNullable<ReturnType<typeof usePost>["data"]>

function usePost(postId: string) {
  return useQuery(getApiV1PostByIdOptions({ path: { id: postId } }))
}

/** Detail page for a profile post: /user/:username/comments/:id[/:slug]. */
function ProfilePostDetailPage() {
  const { username, _splat } = Route.useParams()
  const postId = (_splat ?? "").split("/")[0]
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const postQuery = usePost(postId)

  const postKey = getApiV1PostByIdOptions({ path: { id: postId } }).queryKey
  const permalinkBase = `/user/${username}/comments/${postId}`

  const voteMutation = useMutation({
    mutationFn: (input: VoteInput) =>
      putApiV1PostVoteByPostId({ path: { postId }, body: input, throwOnError: true }),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: postKey })
      toast.error("Could not register your vote")
    },
  })

  function castVote(input: VoteInput) {
    if (!postQuery.data) return
    const newVote = voteInputValue(input)
    queryClient.setQueryData<PostData>(postKey, (old) =>
      old ? { ...old, userVote: newVote, score: old.score + (newVote - old.userVote) } : old,
    )
    voteMutation.mutate(input)
  }

  const {
    extras: voteExtras,
    onUpvote,
    dialogs: voteDialogs,
  } = usePostVoteExtras({
    postId,
    userVote: postQuery.data?.userVote ?? 0,
    ups: postQuery.data?.ups,
    onCastVote: castVote,
  })

  // Keep the canonical title slug on the URL (history REPLACE, never a push).
  const postSlug = (postQuery.data as { slug?: string } | undefined)?.slug
  useEffect(() => {
    if (typeof window === "undefined" || !postSlug) return
    const canonicalPath = `/user/${username}/comments/${postId}/${postSlug}`
    if (window.location.pathname === canonicalPath) return
    window.history.replaceState(
      window.history.state,
      "",
      canonicalPath + window.location.search + window.location.hash,
    )
  }, [postSlug, username, postId])

  if (postQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const post = postQuery.data
  if (postQuery.isError || !post) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Post not found</h1>
        <p className="text-sm text-muted-foreground">This post may have been removed.</p>
      </div>
    )
  }

  const sort: CommentSortValue = search.sort ?? "best"

  return (
    <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 lg:flex-row">
      <div className="min-w-0 flex-1">
        <PostDetailCard
          post={{
            ...post,
            viewCount: post.isAuthor ? post.viewCount : undefined,
            community: null,
          }}
          insightsHref={`/poststats/${postId}`}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
          onBack={() => {
            window.history.back()
          }}
          wrapAuthorLink={wrapAuthorLink}
          voteDisabled={post.isLocked}
          onUpvote={onUpvote}
          onDownvote={() => {}}
          voteExtras={voteExtras}
          shareSlot={
            <PostShareMenu
              post={{
                id: post.id,
                title: post.title,
                community: null,
              }}
              permalink={permalinkBase}
            />
          }
          menuSlot={
            <PostActionsMenu
              post={{
                id: post.id,
                type: post.type,
                bodyMd: post.bodyMd,
                isNsfw: post.isNsfw,
                isSpoiler: post.isSpoiler,
                isOc: post.isOc,
                isAuthor: post.isAuthor,
                isStriked: post.isStriked,
                author: post.author ? { id: post.author.id, username: post.author.username } : null,
                community: null,
                flair: null,
              }}
              onHidden={() => {
                void navigate({ to: "/user/$username", params: { username } })
              }}
              onDeleted={() => {
                void navigate({ to: "/user/$username", params: { username } })
              }}
              onEdited={() => {
                void queryClient.invalidateQueries({ queryKey: postKey })
              }}
            />
          }
        />
        {voteDialogs}

        <PostCommentSearch postId={postId} communityName="" profileUsername={username} />

        <CommentSection
          postId={postId}
          communityName=""
          permalinkBase={permalinkBase}
          sort={sort}
          focusCommentId={search.comment}
          commentCount={post.commentCount}
          locked={post.isLocked}
          onSortChange={(next) => {
            void navigate({ search: (prev) => ({ ...prev, sort: next }), replace: true })
          }}
          onExitPermalink={() => {
            void navigate({ search: (prev) => ({ ...prev, comment: undefined }), replace: true })
          }}
        />
      </div>

      <aside className="hidden w-full shrink-0 flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:flex lg:max-h-[calc(100vh-4.5rem)] lg:w-80 lg:self-start lg:overflow-y-auto">
        <LegalFooter />
      </aside>
    </div>
  )
}

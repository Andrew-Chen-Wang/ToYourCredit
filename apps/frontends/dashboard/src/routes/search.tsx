import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { CommunityCard } from "@ui/seo-shared/community/CommunityCard"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  applyVoteToCache,
  chipClass,
  CommentResultCard,
  permalinkForPost,
  type PostResult,
  ProfileResultCard,
  type SearchPageData,
  toRowPost,
} from "@frontends/dashboard/components/searchResults"
import { VotablePostRow } from "@frontends/dashboard/components/vote/VotablePostRow"
import {
  voteInputValue,
  type VoteInput,
} from "@frontends/dashboard/components/vote/usePostVoteExtras"
import { getApiV1Search } from "@lib/api-client/generated/sdk.gen"
import {
  getApiV1CommunityByNameOptions,
  postApiV1CommunityMemberByCommunityIdJoinMutation,
  putApiV1PostVoteByPostIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Search as SearchIcon, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type SearchType = "posts" | "comments" | "communities" | "media" | "profiles"
type SearchSort = "relevance" | "hot" | "top" | "new" | "comments"
type TopWindow = "hour" | "day" | "week" | "month" | "year" | "all"

type SearchParams = {
  q: string
  type: SearchType
  sort: SearchSort
  t: TopWindow
  community?: string
  author?: string
}

const TYPES: { value: SearchType; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "communities", label: "Communities" },
  { value: "media", label: "Media" },
  { value: "profiles", label: "Profiles" },
]

const SORTS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "hot", label: "Hot" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "comments", label: "Comments" },
]

const TOP_WINDOWS: { value: TopWindow; label: string }[] = [
  { value: "hour", label: "Now" },
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
]

const TYPE_VALUES = TYPES.map((tp) => tp.value)
const SORT_VALUES = SORTS.map((s) => s.value)
const WINDOW_VALUES = TOP_WINDOWS.map((w) => w.value)

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : "",
    type: oneOf(search.type, TYPE_VALUES, "posts"),
    sort: oneOf(search.sort, SORT_VALUES, "relevance"),
    t: oneOf(search.t, WINDOW_VALUES, "all"),
    community: typeof search.community === "string" ? search.community : undefined,
    author: typeof search.author === "string" ? search.author : undefined,
  }),
  component: SearchPage,
})

function CommunityJoinButton({ communityId }: { communityId: string }) {
  const [state, setState] = useState<"idle" | "joined" | "requested">("idle")
  const join = useMutation({
    ...postApiV1CommunityMemberByCommunityIdJoinMutation(),
    onSuccess: (result) => {
      setState(result.requested ? "requested" : "joined")
    },
    onError: () => toast.error("Could not join community"),
  })
  if (state === "joined") {
    return (
      <Button size="sm" variant="outline" disabled>
        Joined
      </Button>
    )
  }
  if (state === "requested") {
    return (
      <Button size="sm" variant="outline" disabled>
        Requested
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      disabled={join.isPending}
      onClick={() => {
        join.mutate({ path: { communityId } })
      }}
    >
      Join
    </Button>
  )
}

function SearchPage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(params.q)
  useEffect(() => {
    setDraft(params.q)
  }, [params.q])

  const showSort = params.type === "posts" || params.type === "comments" || params.type === "media"
  const showWindow = showSort && params.sort === "top"

  const communityQuery = useQuery({
    ...getApiV1CommunityByNameOptions({ path: { name: params.community ?? "" } }),
    enabled: !!params.community,
  })
  const communityId = communityQuery.data?.id ?? null
  const communityResolved = !params.community || communityId != null

  const queryKey = [
    "search",
    params.q,
    params.type,
    params.sort,
    params.t,
    communityId,
    params.author ?? null,
  ]

  const search = useInfiniteQuery({
    queryKey,
    enabled: params.q.trim().length > 0 && communityResolved,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await getApiV1Search({
        query: {
          q: params.q,
          type: params.type,
          sort: params.sort,
          t: params.t,
          communityId: communityId ?? undefined,
          authorUsername: params.author,
          cursor: pageParam,
        },
        throwOnError: true,
      })
      return data
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const voteMutation = useMutation({
    ...putApiV1PostVoteByPostIdMutation(),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.error("Could not register your vote")
    },
  })

  function castVote(post: PostResult, input: VoteInput) {
    const newVote = voteInputValue(input)
    queryClient.setQueryData<InfiniteData<SearchPageData>>(queryKey, (old) =>
      applyVoteToCache(old, post.id, newVote),
    )
    voteMutation.mutate({ path: { postId: post.id }, body: input })
  }

  function update(patch: Partial<SearchParams>) {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const pages = search.data?.pages ?? []
  const total = pages[0]?.total ?? 0
  const posts = pages.flatMap((p) => p.posts)
  const comments = pages.flatMap((p) => p.comments)
  const communities = pages.flatMap((p) => p.communities)
  const profiles = pages.flatMap((p) => p.profiles)

  const hasQuery = params.q.trim().length > 0
  const isGrid = params.type === "communities"
  const scopeLabel = params.community
    ? `r/${params.community}`
    : params.author
      ? `u/${params.author}`
      : null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: draft.trim() })
        }}
        className="relative mb-3 flex items-center gap-2 rounded-md border bg-background pl-3 focus-within:ring-1 focus-within:ring-ring"
      >
        <SearchIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        {scopeLabel ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {scopeLabel}
            <button
              type="button"
              aria-label="Remove scope"
              className="rounded-full hover:bg-background"
              onClick={() => {
                update({ community: undefined, author: undefined })
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ) : null}
        <input
          type="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          placeholder={scopeLabel ? `Search in ${scopeLabel}` : "Search ToYourCredit"}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
        />
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {TYPES.map((tp) => (
          <button
            key={tp.value}
            type="button"
            onClick={() => {
              update({ type: tp.value })
            }}
            className={chipClass(params.type === tp.value)}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {showSort ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                update({ sort: s.value })
              }}
              className={chipClass(params.sort === s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {showWindow ? (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {TOP_WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => {
                update({ t: w.value })
              }}
              className={cn(chipClass(params.t === w.value), "text-xs")}
            >
              {w.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {!hasQuery ? (
          <p className="text-sm text-muted-foreground">Enter a search term to get started.</p>
        ) : search.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {params.type} found for “{params.q}”.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {total} {total === 1 ? "result" : "results"}
            </p>
            <div className={cn(isGrid ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3")}>
              {(params.type === "posts" || params.type === "media") &&
                posts.map((post) => (
                  <VotablePostRow
                    key={post.id}
                    post={toRowPost(post)}
                    href={permalinkForPost(post)}
                    communityHref={post.community ? `/r/${post.community.name}` : undefined}
                    authorHref={post.author ? `/user/${post.author.username}` : undefined}
                    ups={post.ups}
                    onCastVote={(input) => {
                      castVote(post, input)
                    }}
                  />
                ))}
              {params.type === "comments" &&
                comments.map((result) => (
                  <CommentResultCard key={result.comment.id} result={result} />
                ))}
              {params.type === "communities" &&
                communities.map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={{
                      name: community.name,
                      displayName: community.displayName,
                      description: community.description,
                      iconUrl: mediaUrl(community.iconImageKey),
                      memberCount: community.memberCount,
                    }}
                    joinSlot={<CommunityJoinButton communityId={community.id} />}
                  />
                ))}
              {params.type === "profiles" &&
                profiles.map((profile) => <ProfileResultCard key={profile.id} profile={profile} />)}
            </div>
            {search.hasNextPage ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  disabled={search.isFetchingNextPage}
                  onClick={() => {
                    void search.fetchNextPage()
                  }}
                >
                  {search.isFetchingNextPage ? "Loading…" : "Show more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

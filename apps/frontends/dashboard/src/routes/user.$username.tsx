import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button, buttonVariants } from "@ui/base/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ProfileHeader } from "@ui/seo-shared/profile/ProfileHeader"
import { ProfileSidebarSections } from "@frontends/dashboard/components/profile/ProfileSidebarSections"
import { PostFeed, type FeedPost } from "@frontends/dashboard/components/PostFeed"
import { CommentWithPostList } from "@frontends/dashboard/components/CommentWithPostList"
import { EngagementPostList } from "@frontends/dashboard/components/EngagementPostList"
import { ProfileActions } from "@frontends/dashboard/components/ProfileActions"
import { OverviewFeed } from "@frontends/dashboard/components/profile/OverviewFeed"
import { HistoryTab } from "@frontends/dashboard/components/profile/HistoryTab"
import { FeedViewMenu } from "@frontends/dashboard/components/profile/FeedViewMenu"
import { PROFILE_SORTS } from "@frontends/dashboard/components/profile/FeedSortMenu"
import { useFeedView, type ViewMode } from "@frontends/dashboard/components/profile/useFeedView"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1UserByUsernameByUsernameComments,
  getApiV1UserMeDownvoted,
  getApiV1UserMeHidden,
  getApiV1UserMeSaved,
  getApiV1UserMeUpvoted,
} from "@lib/api-client/generated/sdk.gen"
import {
  getApiV1UserByUsernameByUsernameModeratingOptions,
  getApiV1UserByUsernameByUsernameOptions,
  getApiV1UserByUsernameByUsernameSocialLinksOptions,
  getApiV1UserByUsernameByUsernameStrikesInfiniteOptions,
  getApiV1UserMeOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Badge } from "@ui/base/ui/badge"
import { LoadingButton } from "@ui/base/ui/loading-button"
const PROFILE_TABS = [
  "overview",
  "posts",
  "comments",
  "strikes",
  "saved",
  "history",
  "hidden",
  "upvoted",
  "downvoted",
] as const
type ProfileTab = (typeof PROFILE_TABS)[number]

const PUBLIC_TABS: ProfileTab[] = ["overview", "posts", "comments", "strikes"]

type ProfileSearch = { tab?: ProfileTab }

export const Route = createFileRoute("/user/$username")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
    tab: PROFILE_TABS.includes(search.tab as ProfileTab) ? (search.tab as ProfileTab) : undefined,
  }),
  component: ProfilePage,
})

function postPermalink(post: FeedPost): string {
  return post.community
    ? `/r/${post.community.name}/comments/${post.id}`
    : `/user/${post.author?.username ?? ""}/comments/${post.id}`
}

/**
 * Single-row, horizontally-scrollable profile tab strip. The tabs never wrap;
 * chevron buttons appear at each edge only while there is more to scroll toward
 * and nudge the strip in that direction (matching reddit's overflowing tab bar).
 */
function ScrollableTabsList({ tabs }: { tabs: readonly ProfileTab[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    update()
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [update])

  const nudge = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * 200, behavior: "smooth" })
  }

  return (
    <div className="relative mb-4">
      {canLeft ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Scroll tabs left"
          onClick={() => {
            nudge(-1)
          }}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
        >
          <ChevronLeft className="size-4" />
        </Button>
      ) : null}
      <div ref={scrollRef} onScroll={update} className="no-scrollbar overflow-x-auto">
        <TabsList className="w-max flex-nowrap">
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t} className="flex-none capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {canRight ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Scroll tabs right"
          onClick={() => {
            nudge(1)
          }}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
        >
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

/** A right-aligned toolbar carrying just the card/compact view toggle. */
function ViewToolbar({ view, onChange }: { view: ViewMode; onChange: (next: ViewMode) => void }) {
  return (
    <div className="flex items-center">
      <div className="ml-auto">
        <FeedViewMenu view={view} onChange={onChange} />
      </div>
    </div>
  )
}

function PostsTab({ username }: { username: string }) {
  return (
    <PostFeed
      source={{ kind: "profile", username }}
      sorts={PROFILE_SORTS}
      defaultSort="new"
      showCommunity
      permalinkFor={postPermalink}
      emptyTitle="No posts yet"
      emptyDescription={`u/${username} hasn't posted in any community yet.`}
    />
  )
}

function CommentsTab({ username }: { username: string }) {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <CommentWithPostList
        queryKey={["profile-comments", username]}
        compact={view === "compact"}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserByUsernameByUsernameComments({
            path: { username },
            query: { cursor },
            throwOnError: true,
          })
          return { comments: data.data, nextCursor: data.nextCursor }
        }}
        emptyTitle="No comments yet"
        emptyDescription={`u/${username} hasn't commented yet.`}
      />
    </div>
  )
}

function SavedTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-8">
      <ViewToolbar view={view} onChange={setView} />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Saved posts</h2>
        <EngagementPostList
          queryKey={["me", "saved", "posts"]}
          view={view}
          fetchPage={async (cursor) => {
            const { data } = await getApiV1UserMeSaved({
              query: { type: "posts", cursor },
              throwOnError: true,
            })
            return { posts: data.posts, nextCursor: data.nextCursor }
          }}
          permalinkFor={postPermalink}
          emptyTitle="No saved posts"
          emptyDescription="Posts you save appear here."
          menuInitial={{ saved: true }}
          removeTriggers={{ unsave: true }}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Saved comments</h2>
        <CommentWithPostList
          queryKey={["me", "saved", "comments"]}
          compact={view === "compact"}
          fetchPage={async (cursor) => {
            const { data } = await getApiV1UserMeSaved({
              query: { type: "comments", cursor },
              throwOnError: true,
            })
            return { comments: data.comments, nextCursor: data.nextCursor }
          }}
          emptyTitle="No saved comments"
          emptyDescription="Comments you save appear here."
        />
      </section>
    </div>
  )
}

function HiddenTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <EngagementPostList
        queryKey={["me", "hidden"]}
        view={view}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserMeHidden({ query: { cursor }, throwOnError: true })
          return { posts: data.data, nextCursor: data.nextCursor }
        }}
        permalinkFor={postPermalink}
        emptyTitle="Nothing hidden"
        emptyDescription="Posts you hide appear here."
        menuInitial={{ hidden: true }}
        removeTriggers={{ unhide: true }}
      />
    </div>
  )
}

function UpvotedTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <EngagementPostList
        queryKey={["me", "upvoted"]}
        view={view}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserMeUpvoted({ query: { cursor }, throwOnError: true })
          return { posts: data.data, nextCursor: data.nextCursor }
        }}
        permalinkFor={postPermalink}
        emptyTitle="No upvoted posts"
        emptyDescription="Posts you upvote appear here."
      />
    </div>
  )
}

function DownvotedTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <EngagementPostList
        queryKey={["me", "downvoted"]}
        view={view}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserMeDownvoted({ query: { cursor }, throwOnError: true })
          return { posts: data.data, nextCursor: data.nextCursor }
        }}
        permalinkFor={postPermalink}
        emptyTitle="No downvoted posts"
        emptyDescription="Posts you downvote appear here."
      />
    </div>
  )
}

function StrikesTab({ username }: { username: string }) {
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    ...getApiV1UserByUsernameByUsernameStrikesInfiniteOptions({ path: { username } }),
    initialPageParam: { path: { username } },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const strikes = data?.pages.flatMap((page) => page.data) ?? []
  const activeCount = data?.pages[0]?.activeCount ?? 0

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
  }

  if (strikes.length === 0) {
    return (
      <div className="py-10 text-center">
        <h2 className="text-base font-semibold">No strikes</h2>
        <p className="text-sm text-muted-foreground">
          u/{username} has not received any moderation strikes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {activeCount} active strike{activeCount === 1 ? "" : "s"} in the past year. Strikes are a
        public record of content that broke the rules; 5 active strikes result in suspension.
      </p>
      <ul className="flex flex-col gap-3">
        {strikes.map((strike) => (
          <li key={strike.id} className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {strike.active ? (
                <Badge variant="destructive">Active</Badge>
              ) : (
                <Badge variant="secondary">Expired</Badge>
              )}
              <span>{new Date(strike.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="text-sm font-medium">{strike.reason}</p>
            {strike.contentHidden ? (
              <p className="mt-2 text-sm text-muted-foreground">Content in a private community.</p>
            ) : strike.post ? (
              <div className="mt-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {strike.post.communityName ? <span>r/{strike.post.communityName}</span> : null}
                  {strike.post.removed ? (
                    <Badge variant="outline">Removed by moderators</Badge>
                  ) : null}
                </div>
                <a
                  href={
                    strike.post.communityName
                      ? `/r/${strike.post.communityName}/comments/${strike.post.id}`
                      : `/user/${username}/comments/${strike.post.id}`
                  }
                  className="mt-1 block text-sm font-semibold hover:underline"
                >
                  {strike.post.title ?? "View post"}
                </a>
                {strike.post.bodyMd ? (
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                    {strike.post.bodyMd}
                  </p>
                ) : null}
              </div>
            ) : strike.comment ? (
              <div className="mt-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {strike.comment.communityName ? (
                    <span>r/{strike.comment.communityName}</span>
                  ) : null}
                  <span>
                    Comment{strike.comment.postTitle ? ` on "${strike.comment.postTitle}"` : ""}
                  </span>
                  {strike.comment.removed ? (
                    <Badge variant="outline">Removed by moderators</Badge>
                  ) : null}
                </div>
                {strike.comment.bodyMd ? (
                  <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm">
                    {strike.comment.bodyMd}
                  </p>
                ) : null}
                {strike.comment.postId ? (
                  <a
                    href={
                      strike.comment.communityName
                        ? `/r/${strike.comment.communityName}/comments/${strike.comment.postId}?comment=${strike.comment.id}`
                        : `/user/${username}/comments/${strike.comment.postId}?comment=${strike.comment.id}`
                    }
                    className="mt-1 inline-block text-xs font-medium text-muted-foreground hover:underline"
                  >
                    View in thread
                  </a>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {hasNextPage ? (
        <LoadingButton
          variant="outline"
          className="self-center"
          loading={isFetchingNextPage}
          onClick={() => {
            void fetchNextPage()
          }}
        >
          Load more
        </LoadingButton>
      ) : null}
    </div>
  )
}

function ProfilePage() {
  const { username } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: me } = useQuery(getApiV1UserMeOptions())
  const { data, isLoading, isError } = useQuery(
    getApiV1UserByUsernameByUsernameOptions({ path: { username } }),
  )
  const { data: moderatingData } = useQuery(
    getApiV1UserByUsernameByUsernameModeratingOptions({ path: { username } }),
  )
  const { data: socialLinksData } = useQuery(
    getApiV1UserByUsernameByUsernameSocialLinksOptions({ path: { username } }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">User not found</h1>
        <p className="text-sm text-muted-foreground">
          There is no ToYourCredit user with that username.
        </p>
      </div>
    )
  }

  const isOwnProfile = me?.username.toLowerCase() === data.username.toLowerCase()
  const activeTab: ProfileTab = tab ?? "overview"
  const visibleTabs = isOwnProfile ? PROFILE_TABS : PUBLIC_TABS

  return (
    <div className="pb-10">
      <ProfileHeader
        user={{
          username: data.username,
          displayName: data.displayName,
          about: data.about,
          avatarUrl: mediaUrl(data.avatarImageKey),
          bannerUrl: mediaUrl(data.bannerImageKey),
          postKarma: data.postKarma,
          commentKarma: data.commentKarma,
          createdAt: data.createdAt,
          strikeCount: data.strikeCount,
        }}
        onStrikesClick={() => {
          void navigate({ search: { tab: "strikes" }, replace: true })
        }}
        action={
          isOwnProfile ? (
            <Link to="/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Edit profile
            </Link>
          ) : (
            <ProfileActions username={data.username} />
          )
        }
        sidebarExtra={
          <ProfileSidebarSections
            moderating={moderatingData?.data ?? []}
            socialLinks={socialLinksData?.data ?? []}
            isOwnProfile={isOwnProfile}
          />
        }
      >
        <Tabs
          value={activeTab}
          onValueChange={(next) => {
            void navigate({ search: { tab: next as ProfileTab }, replace: true })
          }}
        >
          <ScrollableTabsList tabs={visibleTabs} />

          <TabsContent value="overview">
            <OverviewFeed username={data.username} />
          </TabsContent>
          <TabsContent value="posts">
            <PostsTab username={data.username} />
          </TabsContent>
          <TabsContent value="comments">
            <CommentsTab username={data.username} />
          </TabsContent>
          <TabsContent value="strikes">
            <StrikesTab username={data.username} />
          </TabsContent>
          {isOwnProfile ? (
            <>
              <TabsContent value="saved">
                <SavedTab />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab />
              </TabsContent>
              <TabsContent value="hidden">
                <HiddenTab />
              </TabsContent>
              <TabsContent value="upvoted">
                <UpvotedTab />
              </TabsContent>
              <TabsContent value="downvoted">
                <DownvotedTab />
              </TabsContent>
            </>
          ) : null}
        </Tabs>
      </ProfileHeader>
    </div>
  )
}

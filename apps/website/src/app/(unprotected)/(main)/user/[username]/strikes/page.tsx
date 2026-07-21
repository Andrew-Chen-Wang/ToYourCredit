import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchUser } from "@lib/dao/user/fetch"
import { fetchUserStrike, strikeWindowStart } from "@lib/dao/userStrike/fetch"
import { db } from "@template-nextjs/db"
import { Badge } from "@ui/base/ui/badge"
import { getCurrentSession } from "@website/lib/auth"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

const PAGE_SIZE = 25

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const user = await fetchUser(db).getOneByUsername(username, ["username"])
  if (!user) {
    return { title: "User not found" }
  }
  const title = `u/${user.username} — Strikes`
  return { title, description: `Moderation strikes on record for u/${user.username}.` }
}

export default async function ProfileStrikesPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { username } = await params
  const query = await searchParams
  const cursor = typeof query.cursor === "string" ? query.cursor : null

  const user = await fetchUser(db).getOneByUsername(username, ["id", "username"])
  if (!user) {
    notFound()
  }

  const session = await getCurrentSession()
  const viewerId = session?.user.id ?? null

  const [rows, activeCount] = await Promise.all([
    fetchUserStrike(db).listForUserPublic(user.id, cursor, PAGE_SIZE),
    fetchUserStrike(db).countActive(user.id),
  ])
  const windowStart = strikeWindowStart()

  const strikes = await Promise.all(
    rows.map(async (r) => {
      const communityVisibility = r.postId
        ? r.postCommunityVisibility
        : r.commentCommunityVisibility
      const communityId = r.postId ? r.postCommunityId : r.commentCommunityId
      let contentHidden = false
      if ((r.postId ?? r.commentId) && communityId && communityVisibility === "private") {
        const view = await getCommunityAuthz(db).canView(
          { id: communityId, visibility: communityVisibility },
          viewerId,
        )
        contentHidden = !view.ok
      }
      return { ...r, active: r.createdAt > windowStart, contentHidden }
    }),
  )

  const nextCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6">
      <div className="mb-4">
        <Link
          href={`/user/${user.username}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← u/{user.username}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Strikes</h1>
        <p className="text-sm text-muted-foreground">
          {activeCount} active strike{activeCount === 1 ? "" : "s"} in the past year. Strikes are a
          public record of content that broke the rules; 5 active strikes result in suspension.
        </p>
      </div>

      {strikes.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            u/{user.username} has not received any moderation strikes.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {strikes.map((strike) => (
            <li key={strike.id} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {strike.active ? (
                  <Badge variant="destructive">Active</Badge>
                ) : (
                  <Badge variant="secondary">Expired</Badge>
                )}
                <span>{strike.createdAt.toLocaleDateString("en-US")}</span>
              </div>
              <p className="text-sm font-medium">{strike.reason}</p>
              {strike.contentHidden ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Content in a private community.
                </p>
              ) : strike.postId ? (
                <div className="mt-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {strike.postCommunityName ? <span>r/{strike.postCommunityName}</span> : null}
                    {strike.postRemovedAt ? (
                      <Badge variant="outline">Removed by moderators</Badge>
                    ) : null}
                  </div>
                  <Link
                    href={
                      strike.postCommunityName
                        ? `/r/${strike.postCommunityName}/comments/${strike.postId}`
                        : `/user/${user.username}/comments/${strike.postId}`
                    }
                    className="mt-1 block text-sm font-semibold hover:underline"
                  >
                    {strike.postTitle ?? "View post"}
                  </Link>
                  {strike.postBodyMd ? (
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                      {strike.postBodyMd}
                    </p>
                  ) : null}
                </div>
              ) : strike.commentId ? (
                <div className="mt-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {strike.commentCommunityName ? (
                      <span>r/{strike.commentCommunityName}</span>
                    ) : null}
                    <span>
                      Comment{strike.commentPostTitle ? ` on "${strike.commentPostTitle}"` : ""}
                    </span>
                    {strike.commentRemovedAt ? (
                      <Badge variant="outline">Removed by moderators</Badge>
                    ) : null}
                  </div>
                  {strike.commentBodyMd ? (
                    <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm">
                      {strike.commentBodyMd}
                    </p>
                  ) : null}
                  {strike.commentPostId ? (
                    <Link
                      href={
                        strike.commentCommunityName
                          ? `/r/${strike.commentCommunityName}/comments/${strike.commentPostId}?comment=${strike.commentId}`
                          : `/user/${user.username}/comments/${strike.commentPostId}?comment=${strike.commentId}`
                      }
                      className="mt-1 inline-block text-xs font-medium text-muted-foreground hover:underline"
                    >
                      View in thread
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div className="mt-4 text-center">
          <Link
            href={`/user/${user.username}/strikes?cursor=${nextCursor}`}
            className="text-sm font-medium text-muted-foreground hover:underline"
          >
            Older strikes →
          </Link>
        </div>
      ) : null}
    </div>
  )
}

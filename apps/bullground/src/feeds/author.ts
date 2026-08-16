import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"

const DEFAULT_BOT_USERNAME = "acwangpython"

let cached: { userId: string | null } | undefined

async function resolve(): Promise<string | null> {
  const username = process.env.FEED_BOT_USERNAME ?? DEFAULT_BOT_USERNAME

  const user = await fetchUser(db).getOneByUsername(username, ["id", "suspendedAt"])
  if (user && !user.suspendedAt) return user.id

  if (user?.suspendedAt) {
    console.warn(`[feed-ingest] configured author ${username} is suspended; not posting`)
    return null
  }

  // In production the account is the point — never silently post as somebody else.
  if (process.env.NODE_ENV === "production") {
    console.warn(`[feed-ingest] no user named ${username}; not posting`)
    return null
  }

  // Development: fall back to the first user that exists. ids are uuid v7, so ascending id is
  // oldest-first. If the database has no users at all, post nothing.
  const first = await db
    .selectFrom("user")
    .select(["id", "username"])
    .orderBy("id", "asc")
    .limit(1)
    .executeTakeFirst()
  if (!first) {
    console.warn("[feed-ingest] no users exist; not posting")
    return null
  }
  console.info(`[feed-ingest] ${username} not found; posting as first user ${first.username}`)
  return first.id
}

/**
 * The user new link posts are attributed to, or null when there is nobody to post as (in which
 * case the caller must skip posting rather than pick someone).
 *
 * Memoized for the life of the process; a worker restart re-resolves.
 */
export async function resolveAuthorUserId(): Promise<string | null> {
  cached ??= { userId: await resolve() }
  return cached.userId
}

/** Test seam — drops the memoized author so the next call re-resolves. */
export function resetAuthorCache(): void {
  cached = undefined
}

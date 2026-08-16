import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchFeedSourceState(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["feedSourceState"])[]>(
    sourceId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["feedSourceState"]>, T[number]> | undefined> {
    return await db
      .selectFrom("feedSourceState")
      .select(fields)
      .where("sourceId", "=", sourceId)
      .executeTakeFirst()
  }

  /** Sources whose last fetch failed — the signal that a feed has gone stale. */
  async function listFailing(): Promise<Selectable<DB["feedSourceState"]>[]> {
    return await db
      .selectFrom("feedSourceState")
      .selectAll()
      .where("lastStatus", "=", "error")
      .orderBy("lastFetchedAt", "desc")
      .execute()
  }

  return { getOne, listFailing }
}

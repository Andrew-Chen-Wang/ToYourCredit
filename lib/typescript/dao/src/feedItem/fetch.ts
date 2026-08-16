import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchFeedItem(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["feedItem"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["feedItem"]>, T[number]> | undefined> {
    return await db.selectFrom("feedItem").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getOneByItemKey<T extends (keyof DB["feedItem"])[]>(
    itemKey: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["feedItem"]>, T[number]> | undefined> {
    return await db
      .selectFrom("feedItem")
      .select(fields)
      .where("itemKey", "=", itemKey)
      .executeTakeFirst()
  }

  /** Returns the subset of the given keys that already exist, so a run can filter in one query. */
  async function existingItemKeys(itemKeys: string[]): Promise<Set<string>> {
    if (itemKeys.length === 0) return new Set()
    const rows = await db
      .selectFrom("feedItem")
      .select("itemKey")
      .where("itemKey", "in", itemKeys)
      .execute()
    return new Set(rows.map((r) => r.itemKey))
  }

  async function countForSource(sourceId: string): Promise<number> {
    const row = await db
      .selectFrom("feedItem")
      .where("sourceId", "=", sourceId)
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { getOne, getOneByItemKey, existingItemKeys, countForSource }
}

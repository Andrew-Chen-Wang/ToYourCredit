import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"

interface CreateFeedItemInput {
  id?: string
  sourceId: string
  itemKey: string
  postId?: string | null
}

export function crudFeedItem(db: Kysely<DB>) {
  async function create(input: CreateFeedItemInput): Promise<Selectable<DB["feedItem"]>> {
    return await db
      .insertInto("feedItem")
      .values({
        id: input.id ?? v7(),
        sourceId: input.sourceId,
        itemKey: input.itemKey,
        postId: input.postId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  /**
   * Claims an item key for this source. Returns undefined when another source (or an earlier run)
   * already claimed it — `item_key` is globally unique so a syndicated article posts once.
   */
  async function claim(
    input: CreateFeedItemInput,
  ): Promise<Selectable<DB["feedItem"]> | undefined> {
    return await db
      .insertInto("feedItem")
      .values({
        id: input.id ?? v7(),
        sourceId: input.sourceId,
        itemKey: input.itemKey,
        postId: input.postId ?? null,
      })
      .onConflict((oc) => oc.column("itemKey").doNothing())
      .returningAll()
      .executeTakeFirst()
  }

  async function setPostId(id: string, postId: string | null): Promise<void> {
    await db.updateTable("feedItem").set({ postId }).where("id", "=", id).execute()
  }

  async function deleteById(id: string): Promise<boolean> {
    const result = await db.deleteFrom("feedItem").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function deleteOlderThan(before: Date): Promise<number> {
    const result = await db
      .deleteFrom("feedItem")
      .where("createdAt", "<", before)
      .executeTakeFirst()
    return Number(result.numDeletedRows ?? 0n)
  }

  return { create, claim, setPostId, deleteById, deleteOlderThan }
}

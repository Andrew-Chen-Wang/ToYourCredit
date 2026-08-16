import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

interface UpsertFeedSourceStateInput {
  sourceId: string
  lastFetchedAt?: Date | null
  lastStatus?: "ok" | "error" | null
  lastError?: string | null
  etag?: string | null
  lastModified?: string | null
}

export function crudFeedSourceState(db: Kysely<DB>) {
  async function upsert(
    input: UpsertFeedSourceStateInput,
  ): Promise<Selectable<DB["feedSourceState"]>> {
    const values = {
      sourceId: input.sourceId,
      lastFetchedAt: input.lastFetchedAt ?? null,
      lastStatus: input.lastStatus ?? null,
      lastError: input.lastError ?? null,
      etag: input.etag ?? null,
      lastModified: input.lastModified ?? null,
    }
    return await db
      .insertInto("feedSourceState")
      .values(values)
      .onConflict((oc) =>
        oc.column("sourceId").doUpdateSet({
          lastFetchedAt: values.lastFetchedAt,
          lastStatus: values.lastStatus,
          lastError: values.lastError,
          etag: values.etag,
          lastModified: values.lastModified,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function markOk(
    sourceId: string,
    conditional: { etag?: string | null; lastModified?: string | null },
  ): Promise<void> {
    await upsert({
      sourceId,
      lastFetchedAt: new Date(),
      lastStatus: "ok",
      lastError: null,
      etag: conditional.etag ?? null,
      lastModified: conditional.lastModified ?? null,
    })
  }

  /** Records a failure while preserving the conditional-GET validators from the last good fetch. */
  async function markError(sourceId: string, message: string): Promise<void> {
    const existing = await db
      .selectFrom("feedSourceState")
      .select(["etag", "lastModified"])
      .where("sourceId", "=", sourceId)
      .executeTakeFirst()
    await upsert({
      sourceId,
      lastFetchedAt: new Date(),
      lastStatus: "error",
      lastError: message.slice(0, 1000),
      etag: existing?.etag ?? null,
      lastModified: existing?.lastModified ?? null,
    })
  }

  return { upsert, markOk, markError }
}

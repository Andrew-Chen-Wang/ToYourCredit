import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  // One row per article we have already turned into a post. `item_key` is the normalized
  // article URL and is unique GLOBALLY, not per source: two sources syndicating the same
  // article must produce one post, not two.
  await db.schema
    .createTable("feed_item")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("source_id", "text", (col) => col.notNull())
    .addColumn("item_key", "text", (col) => col.notNull())
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("feed_item_item_key_key", ["item_key"])
    .execute()

  await db.schema
    .createIndex("feed_item_created_at_index")
    .on("feed_item")
    .column("created_at")
    .execute()
  await db.schema
    .createIndex("feed_item_source_id_index")
    .on("feed_item")
    .column("source_id")
    .execute()

  // Per-source conditional-GET state plus the last fetch outcome. `last_status` is the
  // signal for a feed that has silently gone stale (site redesign, feed retired).
  await db.schema
    .createTable("feed_source_state")
    .addColumn("source_id", "text", (col) => col.primaryKey())
    .addColumn("last_fetched_at", "timestamptz")
    .addColumn("last_status", "text")
    .addColumn("last_error", "text")
    .addColumn("etag", "text")
    .addColumn("last_modified", "text")
    .addCheckConstraint("feed_source_state_status_check", sql`last_status IN ('ok', 'error')`)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("feed_source_state").ifExists().execute()
  await db.schema.dropTable("feed_item").ifExists().execute()
}

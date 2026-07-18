import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("post_media")
    .addColumn("hls_master_key", "text")
    .addColumn("hls_status", "text")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("post_media")
    .dropColumn("hls_master_key")
    .dropColumn("hls_status")
    .execute()
}

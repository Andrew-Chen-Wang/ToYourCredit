import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user_strike")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("issued_by_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("set null"))
    .addColumn("comment_id", "uuid", (col) => col.references("comment.id").onDelete("set null"))
    .addColumn("revoked_at", "timestamptz")
    .addColumn("revoked_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      "user_strike_single_content_check",
      sql`NOT (post_id IS NOT NULL AND comment_id IS NOT NULL)`,
    )
    .execute()

  await db.schema
    .createIndex("user_strike_user_active_idx")
    .on("user_strike")
    .columns(["user_id", "created_at desc"])
    .where(sql.ref("revoked_at"), "is", null)
    .execute()
  await db.schema
    .createIndex("user_strike_post_active_key")
    .unique()
    .on("user_strike")
    .column("post_id")
    .where(sql.ref("revoked_at"), "is", null)
    .where("post_id", "is not", null)
    .execute()
  await db.schema
    .createIndex("user_strike_comment_active_key")
    .unique()
    .on("user_strike")
    .column("comment_id")
    .where(sql.ref("revoked_at"), "is", null)
    .where("comment_id", "is not", null)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user_strike").ifExists().execute()
}

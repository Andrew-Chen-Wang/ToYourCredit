import { type Kysely, sql } from "kysely"

const CATEGORY_CHECK = sql`category IN (
  'bad_source', 'needs_better_source', 'inflammatory', 'being_a_dick', 'trolling',
  'wont_accept_wrong', 'off_topic', 'unsupported_argument', 'spam', 'legacy'
)`

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("post_vote_reason")
    .addColumn("post_id", "uuid", (col) => col.notNull())
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("category", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("post_vote_reason_pkey", ["post_id", "user_id", "category"])
    .addForeignKeyConstraint(
      "post_vote_reason_vote_fkey",
      ["post_id", "user_id"],
      "post_vote",
      ["post_id", "user_id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addCheckConstraint("post_vote_reason_category_check", CATEGORY_CHECK)
    .execute()

  await db.schema
    .createIndex("post_vote_reason_post_category_idx")
    .on("post_vote_reason")
    .columns(["post_id", "category", "created_at"])
    .execute()

  await db.schema
    .createTable("comment_vote_reason")
    .addColumn("comment_id", "uuid", (col) => col.notNull())
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("category", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("comment_vote_reason_pkey", ["comment_id", "user_id", "category"])
    .addForeignKeyConstraint(
      "comment_vote_reason_vote_fkey",
      ["comment_id", "user_id"],
      "comment_vote",
      ["comment_id", "user_id"],
      (cb) => cb.onDelete("cascade"),
    )
    .addCheckConstraint("comment_vote_reason_category_check", CATEGORY_CHECK)
    .execute()

  await db.schema
    .createIndex("comment_vote_reason_comment_category_idx")
    .on("comment_vote_reason")
    .columns(["comment_id", "category", "created_at"])
    .execute()

  // Downvotes cast before categories existed carry an uncategorized 'legacy' reason.
  await sql`
    INSERT INTO post_vote_reason (post_id, user_id, category, created_at)
    SELECT post_id, user_id, 'legacy', created_at FROM post_vote WHERE value = -1
  `.execute(db)
  await sql`
    INSERT INTO comment_vote_reason (comment_id, user_id, category, created_at)
    SELECT comment_id, user_id, 'legacy', created_at FROM comment_vote WHERE value = -1
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("comment_vote_reason").ifExists().execute()
  await db.schema.dropTable("post_vote_reason").ifExists().execute()
}

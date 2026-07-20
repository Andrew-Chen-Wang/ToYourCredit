import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  // Recount karma from vote rows, excluding self-votes. Fixes historical drift
  // from (a) self-votes counting toward credit and (b) post/comment deletes
  // never decrementing credit. Scrubbed comments (author_user_id IS NULL)
  // attribute to no one; users with no received votes reset to 0.
  await sql`
    UPDATE "user" u SET post_karma = COALESCE((
      SELECT SUM(pv.value)::int FROM post_vote pv
      JOIN post p ON p.id = pv.post_id
      WHERE p.author_user_id = u.id AND pv.user_id <> u.id
    ), 0)
  `.execute(db)

  await sql`
    UPDATE "user" u SET comment_karma = COALESCE((
      SELECT SUM(cv.value)::int FROM comment_vote cv
      JOIN comment c ON c.id = cv.comment_id
      WHERE c.author_user_id = u.id AND cv.user_id <> u.id
    ), 0)
  `.execute(db)
}

export async function down(_db: Kysely<any>): Promise<void> {
  // One-off data recount; nothing to reverse.
}

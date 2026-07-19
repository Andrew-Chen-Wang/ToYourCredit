import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user")
    .addColumn("verification_status", "text", (col) => col.notNull().defaultTo(sql`'unverified'`))
    .execute()

  await db.schema
    .alterTable("user")
    .addCheckConstraint(
      "user_verification_status_check",
      sql`verification_status IN ('unverified', 'pending', 'verified', 'rejected')`,
    )
    .execute()

  // Users that predate the invite gate keep full access.
  await sql`UPDATE "user" SET verification_status = 'verified'`.execute(db)

  await db.schema
    .createTable("invite_code")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("code", "text", (col) => col.notNull().unique())
    .addColumn("created_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("cascade").notNull(),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("used_by_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("used_at", "timestamptz")
    .addColumn("revoked_at", "timestamptz")
    .addColumn("referral_nickname", "text")
    .execute()

  await db.schema
    .createIndex("invite_code_created_by_user_id_idx")
    .on("invite_code")
    .column("created_by_user_id")
    .execute()

  // A user can consume at most one invite code, ever.
  await sql`
    CREATE UNIQUE INDEX invite_code_used_by_user_id_key
    ON invite_code (used_by_user_id)
    WHERE used_by_user_id IS NOT NULL
  `.execute(db)

  await db.schema
    .createTable("onboarding_application")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) =>
      col.references("user.id").onDelete("cascade").notNull().unique(),
    )
    .addColumn("invite_code_id", "uuid", (col) => col.references("invite_code.id").notNull())
    .addColumn("profile_link", "text", (col) => col.notNull())
    .addColumn("opinion_link", "text", (col) => col.notNull())
    .addColumn("critical_thinking_link", "text", (col) => col.notNull())
    .addColumn("accept_wrong_link", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo(sql`'pending'`))
    .addColumn("rejection_reason", "text")
    .addColumn("reviewed_by_user_id", "uuid", (col) => col.references("user.id"))
    .addColumn("reviewed_at", "timestamptz")
    .addColumn("submitted_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      "onboarding_application_status_check",
      sql`status IN ('pending', 'approved', 'rejected')`,
    )
    .execute()

  await db.schema
    .createIndex("onboarding_application_status_submitted_at_idx")
    .on("onboarding_application")
    .columns(["status", "submitted_at"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("onboarding_application").ifExists().execute()
  await db.schema.dropTable("invite_code").ifExists().execute()
  await db.schema
    .alterTable("user")
    .dropConstraint("user_verification_status_check")
    .ifExists()
    .execute()
  await db.schema.alterTable("user").dropColumn("verification_status").execute()
}

import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("onboarding_application")
    .alterColumn("invite_code_id", (col) => col.dropNotNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Fails if any codeless applications exist.
  await db.schema
    .alterTable("onboarding_application")
    .alterColumn("invite_code_id", (col) => col.setNotNull())
    .execute()
}

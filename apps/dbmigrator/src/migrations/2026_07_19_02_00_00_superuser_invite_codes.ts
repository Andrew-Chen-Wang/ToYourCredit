import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("invite_code")
    .addColumn("is_superuser", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("invite_code").dropColumn("is_superuser").execute()
}

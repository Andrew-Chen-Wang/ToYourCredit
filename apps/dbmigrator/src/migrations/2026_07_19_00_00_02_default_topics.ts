import type { Kysely } from "kysely"
import { v7 } from "uuid"

const DEFAULT_TOPICS = [
  // Countries & regions
  "United States",
  "China",
  "India",
  "European Union",
  "United Kingdom",
  "Germany",
  "France",
  "Japan",
  "Brazil",
  "Russia",
  "Canada",
  "Australia",
  "Mexico",
  "South Korea",
  "Indonesia",
  "Nigeria",
  "South Africa",
  "Middle East",
  "Latin America",
  "Southeast Asia",
  // Policy areas
  "Housing",
  "Healthcare",
  "Immigration",
  "Education",
  "Climate & Energy",
  "Economy & Taxation",
  "Foreign Policy & Defense",
  "Criminal Justice",
  "Elections & Governance",
  "Technology & Privacy",
  "Labor & Employment",
  "Trade",
  "Transportation & Infrastructure",
  "Social Welfare",
  "Agriculture & Food",
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function up(db: Kysely<any>): Promise<void> {
  const { count } = await db
    .selectFrom("topic")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow()

  await db
    .insertInto("topic")
    .values(
      DEFAULT_TOPICS.map((name, i) => ({
        id: v7(),
        name,
        slug: slugify(name),
        displayOrder: Number(count) + i,
      })),
    )
    .onConflict((oc) => oc.column("slug").doNothing())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db
    .deleteFrom("topic")
    .where(
      "slug",
      "in",
      DEFAULT_TOPICS.map((name) => slugify(name)),
    )
    .execute()
}

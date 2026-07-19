export const DOWNVOTE_CATEGORY_LABELS: Record<string, string> = {
  bad_source: "Bad source",
  needs_better_source: "Needs a better source",
  inflammatory: "Inflammatory commentary",
  being_a_dick: "Being a dick",
  trolling: "Trolling",
  wont_accept_wrong: "Won't accept being wrong",
  off_topic: "Off-topic",
  unsupported_argument: "Unsupported argument",
  spam: "Spam",
  legacy: "Downvoted (legacy)",
}

/** Categories a user can select. `legacy` is backfill-only and excluded. */
export const SELECTABLE_DOWNVOTE_CATEGORIES = [
  "bad_source",
  "needs_better_source",
  "inflammatory",
  "being_a_dick",
  "trolling",
  "wont_accept_wrong",
  "off_topic",
  "unsupported_argument",
  "spam",
] as const

export type SelectableDownvoteCategory = (typeof SELECTABLE_DOWNVOTE_CATEGORIES)[number]

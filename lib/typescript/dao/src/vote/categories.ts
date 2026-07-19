export const DOWNVOTE_CATEGORIES = [
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

export type DownvoteCategory = (typeof DOWNVOTE_CATEGORIES)[number]

// Pre-category downvotes are backfilled with this reason; it is never accepted on write.
export const LEGACY_CATEGORY = "legacy"

export type StoredDownvoteCategory = DownvoteCategory | typeof LEGACY_CATEGORY

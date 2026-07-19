/**
 * Cursor-paginated feeds can return the same row on two pages when the ranking
 * shifts between requests (a post moves down while the user paginates). These
 * helpers drop the later duplicates client-side — the first occurrence, in the
 * order the API returned pages, wins.
 */
export function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    result.push(item)
  }
  return result
}

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return dedupeBy(items, (item) => item.id)
}

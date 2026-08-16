// The canonical 103-community topic matrix. Kept in code (rather than read from the DB) so the
// registry's community references can be validated at module load and so classification does not
// need a query per article. Mirrors docs/topics-and-sources.md — change both together.

export const DOMAINS = [
  { token: "Politics", label: "Domestic Politics" },
  { token: "Governance", label: "Governance" },
  { token: "Diplomacy", label: "Foreign Policy" },
  { token: "Trade", label: "Global Trade Strategy" },
  { token: "Macro", label: "Macroeconomics" },
  { token: "Micro", label: "Microeconomics" },
  { token: "Business", label: "Business" },
  { token: "Society", label: "Social & Cultural Issues" },
] as const

export const COUNTRIES = [
  { token: "China", label: "China" },
  { token: "Syria", label: "Syria" },
  { token: "SouthKorea", label: "South Korea" },
  { token: "NorthKorea", label: "North Korea" },
  { token: "Japan", label: "Japan" },
  { token: "US", label: "United States" },
  { token: "UK", label: "United Kingdom" },
  { token: "France", label: "France" },
  { token: "Germany", label: "Germany" },
  { token: "Italy", label: "Italy" },
  { token: "Spain", label: "Spain" },
  { token: "EU", label: "European Union" },
] as const

export const GLOBAL_TOPICS = [
  { name: "Urbanism", label: "Urbanism" },
  { name: "Transit", label: "Transit" },
  { name: "Geopolitics", label: "Geopolitics" },
  { name: "IntlRelations", label: "International Relations" },
  { name: "GlobalTrade", label: "Global Trade" },
  { name: "Macroeconomics", label: "Macroeconomics" },
  { name: "BalancedViews", label: "Balanced Viewpoints" },
] as const

function buildCommunities(): Map<string, string> {
  const map = new Map<string, string>()
  for (const t of GLOBAL_TOPICS) map.set(t.name, t.label)
  for (const c of COUNTRIES) {
    for (const d of DOMAINS) {
      map.set(`${c.token}${d.token}`, `${d.label} — ${c.label}`)
    }
  }
  return map
}

/** name -> display label, for all 103 communities. */
export const COMMUNITY_LABELS: ReadonlyMap<string, string> = buildCommunities()

export function isKnownCommunity(name: string): boolean {
  return COMMUNITY_LABELS.has(name)
}

export function communityLabel(name: string): string {
  return COMMUNITY_LABELS.get(name) ?? name
}

/** All community names for one country, in domain order. */
export function communitiesForCountry(countryToken: string): string[] {
  return DOMAINS.map((d) => `${countryToken}${d.token}`)
}

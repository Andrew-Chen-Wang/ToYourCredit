import { describe, expect, it } from "vitest"
import { classifyByKeyword, keywordsFor, scoreCommunity } from "./keyword"

const CHINA = [
  "ChinaPolitics",
  "ChinaGovernance",
  "ChinaDiplomacy",
  "ChinaTrade",
  "ChinaMacro",
  "ChinaMicro",
  "ChinaBusiness",
  "ChinaSociety",
]

describe("keywordsFor", () => {
  it("resolves a country community by its domain suffix", () => {
    expect(keywordsFor("SouthKoreaMacro")).not.toBeNull()
    expect(keywordsFor("NorthKoreaBusiness")).not.toBeNull()
  })

  it("resolves global topics by exact name, not by suffix", () => {
    // GlobalTrade ends with "Trade" but must use its own global keyword set.
    expect(keywordsFor("GlobalTrade")).toEqual(keywordsFor("GlobalTrade"))
    expect(keywordsFor("GlobalTrade")).not.toEqual(keywordsFor("ChinaTrade"))
    expect(keywordsFor("Macroeconomics")).not.toEqual(keywordsFor("ChinaMacro"))
  })

  it("returns null for an unrecognised community", () => {
    expect(keywordsFor("SomethingElse")).toBeNull()
  })
})

describe("scoreCommunity", () => {
  it("matches on word boundaries, not substrings", () => {
    // "ports" must not match the "port" keyword.
    expect(scoreCommunity("ChinaTrade", "Reports on the new policy")).toBe(0)
    expect(scoreCommunity("ChinaTrade", "Shanghai port congestion worsens")).toBeGreaterThan(0)
  })

  it("is case insensitive", () => {
    expect(scoreCommunity("ChinaMacro", "INFLATION eases")).toBeGreaterThan(0)
  })
})

describe("classifyByKeyword", () => {
  it("routes a tariff headline to the trade community", () => {
    expect(
      classifyByKeyword(CHINA, "Beijing raises tariffs on EU dairy exports", "ChinaPolitics"),
    ).toBe("ChinaTrade")
  })

  it("routes a central bank headline to the macro community", () => {
    expect(
      classifyByKeyword(
        CHINA,
        "PBOC holds its benchmark interest rate steady as inflation eases",
        "ChinaPolitics",
      ),
    ).toBe("ChinaMacro")
  })

  it("routes an earnings headline to the business community", () => {
    expect(
      classifyByKeyword(
        CHINA,
        "Chipmaker posts record quarterly earnings and lifts revenue guidance",
        "ChinaPolitics",
      ),
    ).toBe("ChinaBusiness")
  })

  it("routes a protest headline to the society community", () => {
    expect(
      classifyByKeyword(CHINA, "Students stage protests over university fees", "ChinaPolitics"),
    ).toBe("ChinaSociety")
  })

  it("falls back when nothing matches", () => {
    expect(classifyByKeyword(CHINA, "A quiet week in the provinces", "ChinaPolitics")).toBe(
      "ChinaPolitics",
    )
  })

  it("falls back rather than guessing when the top two tie", () => {
    // "summit" scores Diplomacy; "election" scores Politics; both weight 3 and nothing else hits.
    expect(classifyByKeyword(CHINA, "Summit follows election", "ChinaSociety")).toBe("ChinaSociety")
  })

  it("short-circuits a single candidate without scoring", () => {
    expect(classifyByKeyword(["ChinaTrade"], "anything at all", "ChinaPolitics")).toBe("ChinaTrade")
  })

  it("returns the fallback when there are no candidates", () => {
    expect(classifyByKeyword([], "anything", "Urbanism")).toBe("Urbanism")
  })

  it("routes non-English headlines, which most of the registry's country sources publish", () => {
    const spain = [
      "SpainPolitics",
      "SpainGovernance",
      "SpainDiplomacy",
      "SpainTrade",
      "SpainMacro",
      "SpainMicro",
      "SpainBusiness",
      "SpainSociety",
    ]
    expect(
      classifyByKeyword(
        spain,
        "El Banco de España eleva su previsión de inflación",
        "SpainPolitics",
      ),
    ).toBe("SpainMacro")
    expect(
      classifyByKeyword(
        spain,
        "Mbappé enciende al Madrid en el partido de fútbol",
        "SpainPolitics",
      ),
    ).toBe("SpainSociety")

    const germany = [
      "GermanyPolitics",
      "GermanyGovernance",
      "GermanyMacro",
      "GermanyBusiness",
      "GermanySociety",
    ]
    expect(
      classifyByKeyword(germany, "Koalition einigt sich nach langer Wahl", "GermanySociety"),
    ).toBe("GermanyPolitics")
    expect(classifyByKeyword(germany, "Inflation steigt, Rezession droht", "GermanyPolitics")).toBe(
      "GermanyMacro",
    )
  })

  it("separates the global urbanism and transit topics", () => {
    const globals = ["Urbanism", "Transit"]
    expect(
      classifyByKeyword(globals, "New zoning rules allow more density downtown", "Urbanism"),
    ).toBe("Urbanism")
    expect(
      classifyByKeyword(globals, "Metro ridership recovers as fares are cut", "Urbanism"),
    ).toBe("Transit")
  })
})

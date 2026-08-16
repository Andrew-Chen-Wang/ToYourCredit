# Topics and Sources

The topic universe for ToYourCredit's news-aggregation communities, and the curated source pool for
each topic.

Structure: **7 global/cross-country topics** + **8 domains × 12 countries** = **103 topics**. Each
topic maps 1:1 to a community.

Companion docs:

- [`feed-registry.md`](./feed-registry.md) — the resolved RSS/sitemap/scrape feed for every source
  named here, with verification status.
- [`adding-a-feed-source.md`](./adding-a-feed-source.md) — how to resolve a publication to a
  pollable feed, including `robots.txt` sitemap discovery and date recovery.
- [`deploying-bullground.md`](./deploying-bullground.md) — shipping the worker, and where runtime
  env vars live on the production host.

---

## Community naming

`community.name` is constrained by `community_name_format_check` to `^[A-Za-z0-9_]{3,21}$` and is
unique on `lower(name)` (see `apps/dbmigrator/src/migrations/2026_06_16_00_00_00_communities.ts`).
Per-country community names are therefore `<CountryToken><DomainToken>`, with the readable label in
`display_name`.

### Domain tokens

| Domain                   | Token        |
| ------------------------ | ------------ |
| Domestic Politics        | `Politics`   |
| Governance               | `Governance` |
| Foreign Policy           | `Diplomacy`  |
| Global Trade Strategy    | `Trade`      |
| Macroeconomics           | `Macro`      |
| Microeconomics           | `Micro`      |
| Business                 | `Business`   |
| Social & Cultural Issues | `Society`    |

### Country tokens

| Country        | Token        |
| -------------- | ------------ |
| China          | `China`      |
| Syria          | `Syria`      |
| South Korea    | `SouthKorea` |
| North Korea    | `NorthKorea` |
| Japan          | `Japan`      |
| United States  | `US`         |
| United Kingdom | `UK`         |
| France         | `France`     |
| Germany        | `Germany`    |
| Italy          | `Italy`      |
| Spain          | `Spain`      |
| European Union | `EU`         |

Longest resulting name is `SouthKoreaGovernance` / `NorthKoreaGovernance` at 20 characters.

---

## The flat list (103 topics)

### Global / cross-country (7)

| #   | `name`           | `display_name`          |
| --- | ---------------- | ----------------------- |
| 1   | `Urbanism`       | Urbanism                |
| 2   | `Transit`        | Transit                 |
| 3   | `Geopolitics`    | Geopolitics             |
| 4   | `IntlRelations`  | International Relations |
| 5   | `GlobalTrade`    | Global Trade            |
| 6   | `Macroeconomics` | Macroeconomics          |
| 7   | `BalancedViews`  | Balanced Viewpoints     |

### Domestic Politics (12)

| `name`               | `display_name`                     |
| -------------------- | ---------------------------------- |
| `ChinaPolitics`      | Domestic Politics — China          |
| `SyriaPolitics`      | Domestic Politics — Syria          |
| `SouthKoreaPolitics` | Domestic Politics — South Korea    |
| `NorthKoreaPolitics` | Domestic Politics — North Korea    |
| `JapanPolitics`      | Domestic Politics — Japan          |
| `USPolitics`         | Domestic Politics — United States  |
| `UKPolitics`         | Domestic Politics — United Kingdom |
| `FrancePolitics`     | Domestic Politics — France         |
| `GermanyPolitics`    | Domestic Politics — Germany        |
| `ItalyPolitics`      | Domestic Politics — Italy          |
| `SpainPolitics`      | Domestic Politics — Spain          |
| `EUPolitics`         | Domestic Politics — European Union |

### Governance (12)

| `name`                 | `display_name`              |
| ---------------------- | --------------------------- |
| `ChinaGovernance`      | Governance — China          |
| `SyriaGovernance`      | Governance — Syria          |
| `SouthKoreaGovernance` | Governance — South Korea    |
| `NorthKoreaGovernance` | Governance — North Korea    |
| `JapanGovernance`      | Governance — Japan          |
| `USGovernance`         | Governance — United States  |
| `UKGovernance`         | Governance — United Kingdom |
| `FranceGovernance`     | Governance — France         |
| `GermanyGovernance`    | Governance — Germany        |
| `ItalyGovernance`      | Governance — Italy          |
| `SpainGovernance`      | Governance — Spain          |
| `EUGovernance`         | Governance — European Union |

### Foreign Policy (12)

| `name`                | `display_name`                  |
| --------------------- | ------------------------------- |
| `ChinaDiplomacy`      | Foreign Policy — China          |
| `SyriaDiplomacy`      | Foreign Policy — Syria          |
| `SouthKoreaDiplomacy` | Foreign Policy — South Korea    |
| `NorthKoreaDiplomacy` | Foreign Policy — North Korea    |
| `JapanDiplomacy`      | Foreign Policy — Japan          |
| `USDiplomacy`         | Foreign Policy — United States  |
| `UKDiplomacy`         | Foreign Policy — United Kingdom |
| `FranceDiplomacy`     | Foreign Policy — France         |
| `GermanyDiplomacy`    | Foreign Policy — Germany        |
| `ItalyDiplomacy`      | Foreign Policy — Italy          |
| `SpainDiplomacy`      | Foreign Policy — Spain          |
| `EUDiplomacy`         | Foreign Policy — European Union |

### Global Trade Strategy (12)

| `name`            | `display_name`                         |
| ----------------- | -------------------------------------- |
| `ChinaTrade`      | Global Trade Strategy — China          |
| `SyriaTrade`      | Global Trade Strategy — Syria          |
| `SouthKoreaTrade` | Global Trade Strategy — South Korea    |
| `NorthKoreaTrade` | Global Trade Strategy — North Korea    |
| `JapanTrade`      | Global Trade Strategy — Japan          |
| `USTrade`         | Global Trade Strategy — United States  |
| `UKTrade`         | Global Trade Strategy — United Kingdom |
| `FranceTrade`     | Global Trade Strategy — France         |
| `GermanyTrade`    | Global Trade Strategy — Germany        |
| `ItalyTrade`      | Global Trade Strategy — Italy          |
| `SpainTrade`      | Global Trade Strategy — Spain          |
| `EUTrade`         | Global Trade Strategy — European Union |

### Macroeconomics (12)

| `name`            | `display_name`                  |
| ----------------- | ------------------------------- |
| `ChinaMacro`      | Macroeconomics — China          |
| `SyriaMacro`      | Macroeconomics — Syria          |
| `SouthKoreaMacro` | Macroeconomics — South Korea    |
| `NorthKoreaMacro` | Macroeconomics — North Korea    |
| `JapanMacro`      | Macroeconomics — Japan          |
| `USMacro`         | Macroeconomics — United States  |
| `UKMacro`         | Macroeconomics — United Kingdom |
| `FranceMacro`     | Macroeconomics — France         |
| `GermanyMacro`    | Macroeconomics — Germany        |
| `ItalyMacro`      | Macroeconomics — Italy          |
| `SpainMacro`      | Macroeconomics — Spain          |
| `EUMacro`         | Macroeconomics — European Union |

### Microeconomics (12)

| `name`            | `display_name`                  |
| ----------------- | ------------------------------- |
| `ChinaMicro`      | Microeconomics — China          |
| `SyriaMicro`      | Microeconomics — Syria          |
| `SouthKoreaMicro` | Microeconomics — South Korea    |
| `NorthKoreaMicro` | Microeconomics — North Korea    |
| `JapanMicro`      | Microeconomics — Japan          |
| `USMicro`         | Microeconomics — United States  |
| `UKMicro`         | Microeconomics — United Kingdom |
| `FranceMicro`     | Microeconomics — France         |
| `GermanyMicro`    | Microeconomics — Germany        |
| `ItalyMicro`      | Microeconomics — Italy          |
| `SpainMicro`      | Microeconomics — Spain          |
| `EUMicro`         | Microeconomics — European Union |

### Business (12)

| `name`               | `display_name`            |
| -------------------- | ------------------------- |
| `ChinaBusiness`      | Business — China          |
| `SyriaBusiness`      | Business — Syria          |
| `SouthKoreaBusiness` | Business — South Korea    |
| `NorthKoreaBusiness` | Business — North Korea    |
| `JapanBusiness`      | Business — Japan          |
| `USBusiness`         | Business — United States  |
| `UKBusiness`         | Business — United Kingdom |
| `FranceBusiness`     | Business — France         |
| `GermanyBusiness`    | Business — Germany        |
| `ItalyBusiness`      | Business — Italy          |
| `SpainBusiness`      | Business — Spain          |
| `EUBusiness`         | Business — European Union |

### Social & Cultural Issues (12)

| `name`              | `display_name`                            |
| ------------------- | ----------------------------------------- |
| `ChinaSociety`      | Social & Cultural Issues — China          |
| `SyriaSociety`      | Social & Cultural Issues — Syria          |
| `SouthKoreaSociety` | Social & Cultural Issues — South Korea    |
| `NorthKoreaSociety` | Social & Cultural Issues — North Korea    |
| `JapanSociety`      | Social & Cultural Issues — Japan          |
| `USSociety`         | Social & Cultural Issues — United States  |
| `UKSociety`         | Social & Cultural Issues — United Kingdom |
| `FranceSociety`     | Social & Cultural Issues — France         |
| `GermanySociety`    | Social & Cultural Issues — Germany        |
| `ItalySociety`      | Social & Cultural Issues — Italy          |
| `SpainSociety`      | Social & Cultural Issues — Spain          |
| `EUSociety`         | Social & Cultural Issues — European Union |

---

## Sources

Sources are a shared registry, not a per-topic list — one publication legitimately covers several
cells (Nikkei Asia is Japan + Korea + China + business + trade + macro; Bruegel is EU + macro +
trade + governance). Where a source spans several communities the ingestion pipeline picks the
destination per article, using Claude when available and a keyword classifier otherwise.

### 1. Global / cross-country

| Topic                   | Reporting                                             | Analysis / newsletters                                        | Video                                            |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Urbanism                | Bloomberg CityLab; Streetsblog; The Guardian (Cities) | Strong Towns; Planetizen; Urban Institute                     | Not Just Bikes; City Beautiful; Oh The Urbanity! |
| Transit                 | Streetsblog; Railway Gazette; Bloomberg CityLab       | TransitCenter; Pedestrian Observations; Transit Costs Project | RMTransit; Not Just Bikes; Alan Fisher           |
| Geopolitics             | Financial Times; Reuters; The Economist               | Foreign Affairs; Foreign Policy; War on the Rocks; CFR; CSIS  | CFR; CSIS; Foreign Affairs                       |
| International Relations | Reuters; Financial Times; BBC World                   | CFR; Foreign Affairs; Chatham House; Carnegie; Brookings      | CFR; CSIS; Chatham House                         |
| Global Trade            | Financial Times; Reuters; WSJ                         | PIIE; WTO; Global Trade Alert; Project Syndicate              | CSIS (The Trade Guys); PIIE; WTO                 |
| Macroeconomics          | Financial Times; The Economist; Reuters; WSJ          | IMF (Finance & Development); PIIE; Project Syndicate          | Money & Macro; PIIE; IMF                         |
| Balanced Viewpoints     | Reuters; AP; WSJ (news); Financial Times; BBC         | Semafor; The Dispatch; Project Syndicate                      | Reuters; FT; WSJ; BBC                            |

**Balanced Viewpoints is an ensemble category**, not a single-outlet feed: wire services for
baseline facts, plus economically-oriented interpretation, plus outlets with clearly identified
arguments. A publication's news operation and its opinion pages are different products and should
not be treated as one ideological unit.

### 2. China

**Core pool** — Reporting: Caixin Global, South China Morning Post, Nikkei Asia, Reuters, Financial
Times. Newsletters/blogs: Sinocism, Pekingnology, ChinaTalk, The Wire China. Research: MERICS,
Rhodium Group, MacroPolo, CSIS ChinaPower, Asia Society Policy Institute. Video: ChinaTalk, CSIS
ChinaPower, Asia Society, MERICS.

| Topic                    | Sources                                                     |
| ------------------------ | ----------------------------------------------------------- |
| Domestic Politics        | Sinocism; Pekingnology; Caixin; MERICS; ChinaTalk           |
| Governance               | Sinocism; MERICS; Pekingnology; MacroPolo                   |
| Foreign Policy           | MERICS; CSIS ChinaPower; Foreign Affairs; SCMP; Nikkei Asia |
| Global Trade Strategy    | Rhodium Group; MERICS; PIIE; Caixin; FT                     |
| Macroeconomics           | Caixin; PIIE; MacroPolo; Rhodium Group; FT                  |
| Microeconomics           | Caixin; MacroPolo; The Wire China; ChinaTalk                |
| Business                 | Caixin; The Wire China; SCMP; Nikkei Asia; FT               |
| Social & Cultural Issues | Sixth Tone; SCMP; ChinaTalk; Caixin                         |

China is a case where China-centred sources are ingested alongside Western analysis rather than
relying on Reuters/FT alone.

### 3. Syria

**Core pool** — Reporting: Syria Direct, Enab Baladi, Reuters, AP, Al Jazeera. Business/economics:
The Syria Report. Analysis: Middle East Institute, Carnegie Middle East Center, International Crisis
Group. Video: Syria Direct, Al Jazeera English, Middle East Institute.

| Topic                    | Sources                                              |
| ------------------------ | ---------------------------------------------------- |
| Domestic Politics        | Syria Direct; Enab Baladi; Reuters; MEI              |
| Governance               | Syria Direct; Enab Baladi; Carnegie Middle East; MEI |
| Foreign Policy           | Reuters; MEI; Carnegie Middle East; Crisis Group     |
| Global Trade Strategy    | The Syria Report; Reuters; MEI                       |
| Macroeconomics           | The Syria Report; World Bank; MEI                    |
| Microeconomics           | The Syria Report; Enab Baladi; Syria Direct          |
| Business                 | The Syria Report; Reuters; Enab Baladi               |
| Social & Cultural Issues | Syria Direct; Enab Baladi; Al Jazeera                |

Local specialist media matter more here than anywhere else in the matrix — Syrian economic and
political institutions are changing quickly and a generic international paper does not give
sufficient granularity.

### 4. South Korea

**Core pool** — Reporting: Korea Herald, Korea JoongAng Daily, The Korea Times, Hankyoreh, Reuters.
Regional analysis: East Asia Forum, Korea Economic Institute, CSIS Korea Chair. Business: Korea
Economic Daily, Pulse by Maeil Business, Nikkei Asia. Video: Arirang News, CSIS, CNA.

| Topic                    | Sources                                                      |
| ------------------------ | ------------------------------------------------------------ |
| Domestic Politics        | Korea Herald; Hankyoreh; Korea JoongAng Daily; Reuters       |
| Governance               | Korea Herald; Hankyoreh; East Asia Forum                     |
| Foreign Policy           | CSIS Korea Chair; Korea Herald; East Asia Forum; Nikkei Asia |
| Global Trade Strategy    | Korea Economic Daily; Nikkei Asia; CSIS; FT                  |
| Macroeconomics           | Korea Economic Daily; Bank of Korea; Nikkei Asia; Reuters    |
| Microeconomics           | Korea Economic Daily; Korea Herald; Maeil Business           |
| Business                 | Korea Economic Daily; Maeil Business; Nikkei Asia            |
| Social & Cultural Issues | Korea Herald; Hankyoreh; Korea JoongAng Daily                |

### 5. North Korea

North Korea gets its own specialist source universe rather than sharing South Korean sources.

**Core pool** — Reporting: NK News / Korea Pro, Reuters, AP. Analysis: 38 North, CSIS Beyond
Parallel, National Committee on North Korea. Video: NK News, CSIS Korea, 38 North.

| Topic                    | Sources                       |
| ------------------------ | ----------------------------- |
| Domestic Politics        | NK News; 38 North; Reuters    |
| Governance               | 38 North; NK News; Korea Pro  |
| Foreign Policy           | 38 North; NK News; CSIS; NCNK |
| Global Trade Strategy    | NK News; 38 North; Korea Pro  |
| Macroeconomics           | 38 North; Korea Pro; NK News  |
| Microeconomics           | Daily NK; NK News; 38 North   |
| Business                 | Korea Pro; NK News; Daily NK  |
| Social & Cultural Issues | Daily NK; NK News; 38 North   |

### 6. Japan

**Core pool** — Reporting/business: Nikkei Asia / Nikkei, The Japan Times, Asahi Shimbun, Yomiuri
Shimbun, Reuters. Analysis: East Asia Forum, Asia Society, CSIS Japan Chair. Video: Nikkei Asia,
Japan Times, CNA, CSIS.

| Topic                    | Sources                                         |
| ------------------------ | ----------------------------------------------- |
| Domestic Politics        | Japan Times; Nikkei; Asahi; Yomiuri             |
| Governance               | Nikkei; Japan Times; East Asia Forum            |
| Foreign Policy           | Nikkei Asia; Japan Times; CSIS; East Asia Forum |
| Global Trade Strategy    | Nikkei; FT; East Asia Forum                     |
| Macroeconomics           | Nikkei; FT; Reuters; Bank of Japan              |
| Microeconomics           | Nikkei; Japan Times                             |
| Business                 | Nikkei; Nikkei Asia; FT                         |
| Social & Cultural Issues | Japan Times; Asahi; Nikkei                      |

### 7. United States

**Core pool** — Reporting: WSJ, NYT, Washington Post, Reuters, AP, Politico. Inside-politics:
Punchbowl News, Politico. Analysis (right): The Dispatch, AEI, National Review. Analysis
(left/centre-left): Brookings, The Atlantic, Vox. Institutions/law: Lawfare. Foreign policy: CFR,
Foreign Affairs, War on the Rocks.

| Topic                    | Sources                                           |
| ------------------------ | ------------------------------------------------- |
| Domestic Politics        | Politico; Punchbowl; WSJ; NYT; Reuters            |
| Governance               | Lawfare; Brookings; AEI; Politico                 |
| Foreign Policy           | CFR; Foreign Affairs; War on the Rocks; Brookings |
| Global Trade Strategy    | PIIE; FT; WSJ; CSIS                               |
| Macroeconomics           | WSJ; FT; PIIE; Federal Reserve; Bloomberg         |
| Microeconomics           | WSJ; Bloomberg; The Economist                     |
| Business                 | WSJ; Bloomberg; FT; Reuters                       |
| Social & Cultural Issues | NYT; WSJ; The Atlantic; The Dispatch              |

US politics is where deliberate pairs are ingested — Brookings + AEI, The Atlantic + The Dispatch,
NYT + WSJ — rather than assigning an artificial neutrality score to any one outlet.

### 8. United Kingdom

**Core pool** — Financial Times, BBC, The Times, The Guardian, The Telegraph, The Economist,
PoliticsHome, Institute for Government, Chatham House.

| Topic                    | Sources                                                   |
| ------------------------ | --------------------------------------------------------- |
| Domestic Politics        | BBC; The Times; The Guardian; The Telegraph; PoliticsHome |
| Governance               | Institute for Government; BBC; FT                         |
| Foreign Policy           | Chatham House; FT; BBC                                    |
| Global Trade Strategy    | FT; Chatham House; The Economist                          |
| Macroeconomics           | FT; The Economist; Bank of England                        |
| Microeconomics           | FT; The Economist                                         |
| Business                 | FT; The Times; Reuters                                    |
| Social & Cultural Issues | BBC; The Guardian; The Times; The Telegraph               |

### 9. France

French-language originals are included deliberately; translation happens downstream.

**Core pool** — Le Monde, Les Echos, Le Figaro, Libération, France 24, Politico Europe. Analysis:
IFRI, Institut Montaigne, ECFR.

| Topic                    | Sources                                          |
| ------------------------ | ------------------------------------------------ |
| Domestic Politics        | Le Monde; Le Figaro; Libération; Politico Europe |
| Governance               | Le Monde; Institut Montaigne                     |
| Foreign Policy           | Le Monde; IFRI; ECFR                             |
| Global Trade Strategy    | Les Echos; FT; IFRI                              |
| Macroeconomics           | Les Echos; Le Monde; FT                          |
| Microeconomics           | Les Echos                                        |
| Business                 | Les Echos; FT; Le Monde                          |
| Social & Cultural Issues | Le Monde; Libération; Le Figaro                  |

The Le Monde + Le Figaro + Libération combination is deliberate: three different French political
traditions rather than France filtered entirely through Anglo-American media.

### 10. Germany

**Core pool** — Der Spiegel, Süddeutsche Zeitung, FAZ, Die Zeit, DW. Business: Handelsblatt.
Analysis: SWP Berlin, Kiel Institute, ECFR.

| Topic                    | Sources                           |
| ------------------------ | --------------------------------- |
| Domestic Politics        | Der Spiegel; FAZ; Süddeutsche; DW |
| Governance               | FAZ; Süddeutsche; SWP             |
| Foreign Policy           | SWP; DW; FAZ; ECFR                |
| Global Trade Strategy    | Handelsblatt; Kiel Institute; FT  |
| Macroeconomics           | Handelsblatt; Kiel Institute; FT  |
| Microeconomics           | Handelsblatt                      |
| Business                 | Handelsblatt; FAZ; FT             |
| Social & Cultural Issues | Die Zeit; Der Spiegel; FAZ        |

### 11. Italy

**Core pool** — Corriere della Sera, La Repubblica, La Stampa. Business: Il Sole 24 Ore. Analysis:
ISPI. Video: Sky TG24, ISPI.

| Topic                    | Sources                            |
| ------------------------ | ---------------------------------- |
| Domestic Politics        | Corriere; La Repubblica; La Stampa |
| Governance               | Corriere; ISPI                     |
| Foreign Policy           | ISPI; Corriere; Politico Europe    |
| Global Trade Strategy    | Il Sole 24 Ore; ISPI; FT           |
| Macroeconomics           | Il Sole 24 Ore; FT                 |
| Microeconomics           | Il Sole 24 Ore                     |
| Business                 | Il Sole 24 Ore                     |
| Social & Cultural Issues | Corriere; La Repubblica; La Stampa |

### 12. Spain

**Core pool** — El País, El Mundo, ABC, La Vanguardia. Business: Expansión, Cinco Días. Analysis:
Elcano Royal Institute.

| Topic                    | Sources                          |
| ------------------------ | -------------------------------- |
| Domestic Politics        | El País; El Mundo; ABC           |
| Governance               | El País; El Mundo                |
| Foreign Policy           | Elcano; El País                  |
| Global Trade Strategy    | Expansión; Elcano                |
| Macroeconomics           | Expansión; Cinco Días; FT        |
| Microeconomics           | Expansión; Cinco Días            |
| Business                 | Expansión; Cinco Días            |
| Social & Cultural Issues | El País; El Mundo; La Vanguardia |

### 13. European Union

The EU is a category in its own right, not an average of France/Germany/etc.

**Core pool** — Reporting: Politico Europe, Euractiv, EUobserver, FT. Economics: Bruegel. Foreign
policy/geopolitics: ECFR, Carnegie Europe, Chatham House. Primary sources: European Commission,
European Council, ECB. Video: Politico Europe, Euractiv, Bruegel, ECFR.

| Topic                    | Sources                                                    |
| ------------------------ | ---------------------------------------------------------- |
| Domestic Politics        | Politico Europe; Euractiv; EUobserver                      |
| Governance               | Euractiv; Politico Europe; EUobserver; European Commission |
| Foreign Policy           | ECFR; Carnegie Europe; Politico Europe; Chatham House      |
| Global Trade Strategy    | Bruegel; FT; Euractiv; European Commission                 |
| Macroeconomics           | Bruegel; FT; ECB                                           |
| Microeconomics           | Bruegel; FT; Euractiv                                      |
| Business                 | FT; Politico Europe; Euractiv                              |
| Social & Cultural Issues | EUobserver; Politico Europe; Euractiv                      |

---

## Provenance

Derived from the "Topic Matrix Organization" conversation
(`chatgpt.com/share/6a81e8d2-5730-83ea-9ceb-8d44c8b5c416`), transcribed here so the taxonomy lives
in the repository rather than in a chat link.

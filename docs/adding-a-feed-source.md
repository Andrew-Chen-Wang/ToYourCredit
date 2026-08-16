# Adding a feed source

How to resolve a publication to something the ingest job can poll, and the traps that cost us time
the first time round. Companion to [`feed-registry.md`](./feed-registry.md) (what we ended up with)
and [`topics-and-sources.md`](./topics-and-sources.md) (why these publications).

A source is only usable if we can get **a headline, a link, and ideally a date** out of it. Missing
a headline is fatal — a link post needs a title. Missing a date is survivable but degrades quality:
undated items skip the 24-hour freshness filter, so URL dedupe becomes the only thing stopping
repeats.

---

## Resolution order

1. **RSS / Atom.** Try the obvious paths (`/feed`, `/rss`, `/rss.xml`, `/feed/`), then ask the
   homepage what it advertises:

   ```sh
   curl -sSL https://example.com/ | grep -oE '<link[^>]*application/(rss|atom)\+xml[^>]*>'
   ```

   Treat this as a hint, not an answer — see "advertised but not served" below.

2. **YouTube channels.** Resolve the handle to its `UC…` id, then use the Atom feed:

   ```sh
   curl -sSL https://www.youtube.com/@Handle | grep -o '"externalId":"UC[^"]*"'
   # -> https://www.youtube.com/feeds/videos.xml?channel_id=UC...
   ```

3. **News sitemaps — check `robots.txt` first.** See below. This is the highest-yield step and the
   easiest to skip.

4. **Scrape an index page.** Last resort (`kind: "html"` + an `htmlRule`). Honor `robots.txt`; the
   ingest job checks it before fetching.

5. **Give up honestly.** Record the source with `kind: "none"` and a note saying what you tried.
   A documented dead end is worth more than a silent omission.

---

## Insight 1: `robots.txt` lists the sitemaps

**Before concluding a source has no machine-readable feed, read its `robots.txt`.** Sites that
block every RSS path routinely advertise news sitemaps there, and those sitemaps are frequently
_not_ behind the same protection.

```sh
curl -sSL https://example.com/robots.txt | grep -i '^sitemap:'
```

This is also the right move **before writing a scraper**. A scraper is per-source code that breaks
on the next redesign; a news sitemap is a stable, structured contract. Always spend the one `curl`
before reaching for `kind: "html"`.

What this actually recovered here:

| Source            | Every feed path                   | `robots.txt` sitemap        | Result            |
| ----------------- | --------------------------------- | --------------------------- | ----------------- |
| La Stampa         | 308 redirect loop, forever        | `/sitemap-n.xml`            | **358 headlines** |
| Bloomberg CityLab | 403 on every path, any user agent | `/sitemaps/news/latest.xml` | **95 headlines**  |

Two live sources that would otherwise have been written off, with no scraper and no user-agent
spoofing — both accept our own `ReadItBot/1.0`.

### Three ways a sitemap still fails

- **No `<news:title>` → no headline → unusable.** A plain `<urlset>` of `<loc>` entries is for
  crawlers, not for us. Brookings' `article-sitemap.xml` returns 998 URLs and zero titles;
  PoliticsHome's returns 530. Both stay `none`.
- **A sitemap _index_ needs another hop.** `<sitemapindex>` contains `<sitemap>`, not `<url>`. If
  a fetch returns 200 with zero items, check which root element you actually got — Reuters'
  `news-sitemap-index` is an index whose child is the real feed, and that child is what the
  registry points at.
- **It can be thin.** The Times' `/sitemaps/news` parses correctly and contained a single entry.
  Not worth polling.

Check the root element rather than guessing:

```sh
curl -sSL "$URL" | head -c 300
grep -c 'news:title' file.xml   # headlines present?
grep -c '<sitemap>' file.xml    # it's an index, hop again
```

---

## Insight 2: check the URLs for dates

**When a feed has no date element, the URLs inside it very often do.** Publishing CMSes date-stamp
asset and article paths, so an item can know its own publication date even when the XML never says
so.

Hankyoreh is the case that prompted this. Its feed carries no `pubDate`, no `dc:date` — nothing.
Grepping for date _tags_ finds nothing and the obvious conclusion is "this feed is undated". But
every item's thumbnail sits under a dated path:

```
https://flexible.img.hani.co.kr/.../imgdb/original/2026/0814/3717866960662286.webp
                                              ^^^^^^^^^  2026-08-14
```

30 of 30 items. The parser now falls back to scanning the item's description and link for these
shapes:

| Pattern        | Example        |
| -------------- | -------------- |
| `/YYYY/MMDD/`  | `/2026/0814/`  |
| `/YYYY/MM/DD/` | `/2026/08/14/` |
| `_YYYYMMDD_`   | `_20260814-`   |

Rules that keep this honest, all covered by tests in `parse.test.ts`:

- **Last resort only.** Consulted only when every date element is absent, so it can never override
  a real date. A stale slug like `/2020/01/02/` on a fresh article is ignored if the feed also
  ships a `pubDate`.
- **Sanity-checked.** Month/day ranges are validated, and a path date more than two days in the
  future is rejected rather than trusted.
- **Date-only precision.** It resolves to midnight UTC. Fine for a 24-hour window; do not use it
  for ordering within a day.

### Don't confuse this with a _localized_ date

A different failure with the same symptom: the feed _has_ `<pubDate>`, but `new Date()` can't read
it. Sky TG24 emits `lun, 17 ago 2026 10:00:00 GMT` — Italian weekday and month. JavaScript only
parses English month names, so every item silently became undated. The parser now translates month
abbreviations across Italian, Spanish, French, German, Portuguese and Dutch before giving up. That
one fix took Sky TG24 from 0 usable dates to 100.

So when a feed looks undated, there are three distinct possibilities — distinguish them before
concluding anything:

1. There is no date anywhere (Nikkei Asia — 26KB, 50 items, not one date string in the file).
2. There is a date element we can't parse (localized month names).
3. There is no date element but the URLs know (Hankyoreh).

---

## Insight 3: the subdomain can lie

`english.hani.co.kr/rss` and `english.hani.co.kr/rss/` both serve the **Korean** all-articles feed,
linking to `www.hani.co.kr` with Korean headlines. Only `/rss/english_edition` is the English
edition. Check the actual item titles and links before trusting a hostname:

```sh
curl -sSL "$URL" | grep -o '<link>[^<]*' | head -3
```

---

## Checklist before adding an entry

- [ ] Fetched with `ReadItBot/1.0 (+feed-ingest)` — not just a browser UA. If it only works with a
      browser UA, say so in `notes`.
- [ ] Parses via `parseFeed`, not just "returns 200". HTML error pages return 200 all the time.
- [ ] Has headlines. No title means no post.
- [ ] Dates present, or you know which of the three date cases above applies.
- [ ] `communities` is as narrow as honest. A single-community source skips classification
      entirely — no content fetch, no model call. Only list several when the source genuinely
      spans them.
- [ ] `defaultCommunity` is in `communities` (the registry throws at load if not).
- [ ] Ran `pnpm --filter=bullground run feeds:check <id>`.
- [ ] Ran `pnpm --filter=bullground run feeds:doc` to regenerate the registry doc.

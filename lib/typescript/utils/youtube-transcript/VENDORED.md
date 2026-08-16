# Vendored: YouTube transcript fetching

## Upstream

- Project: `youtube-transcript`
- Repository: https://github.com/Kakulukian/youtube-transcript
- Author: Kakulukian
- Version referenced: 1.3.1
- License: MIT (declared in the upstream `package.json` `license` field and in the upstream README;
  note the repository does not currently ship a `LICENSE` file, so `./LICENSE` here reproduces the
  standard MIT text under that declared grant)
- Vendored on: 2026-08-16

## Why vendored rather than depended on

The implementation talks to two undocumented YouTube endpoints (the InnerTube `player` API and the
caption-track `baseUrl`). Those break without warning when YouTube changes, and when they do we need
to be able to patch in-tree on the same day rather than wait on an upstream release. Vendoring also
keeps the bullground image free of a transitive dependency whose only consumer is one job.

## What was kept from upstream

The load-bearing protocol knowledge:

- The InnerTube `player` endpoint and the ANDROID client context needed to get caption tracks
  without scraping HTML.
- The fallback path of scraping `ytInitialPlayerResponse` out of the watch page.
- The location of caption tracks in the player response
  (`captions.playerCaptionsTracklistRenderer.captionTracks`).
- Both caption XML shapes YouTube serves: the newer `srv3` (`<p t d>` / `<s>`) and the classic
  (`<text start dur>`).
- The SSRF guard that rejects any caption `baseUrl` not on a `youtube.com` host.

## What was changed locally

- Rewritten in this repo's conventions: oxfmt style (no semicolons, double quotes, 100 columns),
  module-level functions instead of a static-only class, and real types instead of `any`.
- **Failure model inverted.** Upstream throws a taxonomy of error classes. Callers here only need
  "did we get a transcript or not", and a throw from an optional enrichment step must never fail the
  ingest job — so `getTranscriptText()` returns `null` on every expected failure (no captions,
  captions disabled, video gone, rate-limited) and logs a single `console.warn` with a
  `[youtube-transcript]` prefix, matching the logging convention in `apps/bullground`.
- Added `getTranscriptText()`, which joins segments into one plain-text string — the only shape the
  feed classifier actually consumes.
- Added an explicit request timeout (upstream has none) so a hung YouTube request cannot stall a
  BullMQ worker slot.
- Added a byte cap on the caption response.
- Dropped the language-negotiation error class; an unavailable requested language now falls back to
  the video's default track rather than throwing.

## Updating

Re-check https://github.com/Kakulukian/youtube-transcript for protocol changes (particularly
`INNERTUBE_CLIENT_VERSION`), then port the delta by hand. Do not replace this file wholesale — the
public surface here is deliberately narrower than upstream's.

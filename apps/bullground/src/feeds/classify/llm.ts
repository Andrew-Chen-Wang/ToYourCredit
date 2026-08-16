// Optional Claude-based classifier. Everything here is best-effort: if the SDK is not installed,
// no credential is configured, the call times out, or the answer is not one of the candidates,
// the caller silently falls back to the keyword classifier. Classification quality is not worth
// failing an ingest run over.

const DEFAULT_MODEL = "claude-opus-5"
const CALL_TIMEOUT_MS = 30 * 1000
const MAX_CONCURRENT = 3
const MAX_CONTENT_CHARS = 6000

const SYSTEM_PROMPT = `You route news articles into forum communities.

You are given an article's title, optionally some of its body text or video transcript, and a
list of candidate communities. Choose the single community the article best belongs in.

Reply with the community name exactly as it appears in the candidate list. No punctuation, no
explanation, no other words. If none fits clearly better than the others, reply with the first
candidate.`

export interface Candidate {
  name: string
  label: string
}

type QueryFn = (args: {
  prompt: string
  options?: Record<string, unknown>
}) => AsyncIterable<unknown>

let sdkPromise: Promise<QueryFn | null> | undefined

function hasCredential(): boolean {
  return Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY)
}

/** Resolves the SDK's `query` once per process; null means "classify with keywords instead". */
async function loadQuery(): Promise<QueryFn | null> {
  sdkPromise ??= (async () => {
    if (!hasCredential()) {
      console.info("[feed-classify] no Claude credential configured; using keyword classifier")
      return null
    }
    try {
      const mod = (await import("@anthropic-ai/claude-agent-sdk")) as { query?: QueryFn }
      if (typeof mod.query !== "function") {
        console.warn("[feed-classify] claude-agent-sdk has no query export; using keywords")
        return null
      }
      return mod.query
    } catch (err: unknown) {
      console.warn("[feed-classify] claude-agent-sdk unavailable; using keywords:", err)
      return null
    }
  })()
  return await sdkPromise
}

export async function isLlmAvailable(): Promise<boolean> {
  return (await loadQuery()) !== null
}

let active = 0
const waiting: (() => void)[] = []

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return
  }
  await new Promise<void>((resolve) => waiting.push(resolve))
  active++
}

function releaseSlot(): void {
  active--
  waiting.shift()?.()
}

function buildPrompt(candidates: Candidate[], title: string, content: string): string {
  const list = candidates.map((c) => `- ${c.name}: ${c.label}`).join("\n")
  const body = content.trim().slice(0, MAX_CONTENT_CHARS)
  return [
    "Candidate communities:",
    list,
    "",
    `Article title: ${title}`,
    body ? `\nArticle content:\n${body}` : "",
    "",
    "Which community?",
  ].join("\n")
}

/** Pulls the final text out of the SDK's message stream. */
function resultText(message: unknown): string | null {
  const m = message as { type?: unknown; subtype?: unknown; result?: unknown }
  if (m?.type === "result" && m.subtype === "success" && typeof m.result === "string") {
    return m.result
  }
  return null
}

/**
 * Asks Claude which candidate a story belongs in. Returns null whenever the answer cannot be
 * trusted — unavailable SDK, timeout, error, or a reply outside the candidate set.
 */
export async function classifyByLlm(
  candidates: Candidate[],
  title: string,
  content: string,
): Promise<string | null> {
  if (candidates.length < 2) return null

  const query = await loadQuery()
  if (!query) return null

  await acquireSlot()
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, CALL_TIMEOUT_MS)

  try {
    const stream = query({
      prompt: buildPrompt(candidates, title, content),
      options: {
        model: process.env.FEED_CLASSIFIER_MODEL ?? DEFAULT_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        allowedTools: [],
        maxTurns: 1,
        // Do not inherit the host machine's CLAUDE.md / settings; this must behave identically
        // on a laptop and in the production container.
        settingSources: [],
        abortController: controller,
      },
    })

    let answer: string | null = null
    for await (const message of stream) {
      const text = resultText(message)
      if (text !== null) {
        answer = text
        break
      }
    }
    if (answer === null) return null

    const cleaned = answer.trim().replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_]+$/g, "")
    const match = candidates.find((c) => c.name.toLowerCase() === cleaned.toLowerCase())
    if (!match) {
      console.warn(`[feed-classify] model returned an unknown community: ${cleaned.slice(0, 60)}`)
      return null
    }
    return match.name
  } catch (err: unknown) {
    console.warn("[feed-classify] classification failed; using keywords:", err)
    return null
  } finally {
    clearTimeout(timeout)
    releaseSlot()
  }
}

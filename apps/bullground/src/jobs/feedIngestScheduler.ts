import type { JobPayloadMap } from "@utils/queues"
import { enqueueFeedIngestSource } from "@utils/queues"
import { ACTIVE_SOURCES } from "../feeds/registry"

// Sources are spread over a few minutes rather than fired at once: ~120 simultaneous outbound
// fetches would look like an attack to some hosts and would saturate the slow queue.
const STAGGER_MS = 2000

export async function processFeedIngestScheduler(
  _data: JobPayloadMap["feed-ingest-scheduler"],
): Promise<void> {
  let enqueued = 0
  for (const [index, source] of ACTIVE_SOURCES.entries()) {
    try {
      await enqueueFeedIngestSource(source.id, index * STAGGER_MS)
      enqueued++
    } catch (err: unknown) {
      console.warn(`[feed-ingest-scheduler] could not enqueue ${source.id}:`, err)
    }
  }
  console.info(`[feed-ingest-scheduler] enqueued ${enqueued}/${ACTIVE_SOURCES.length} source(s)`)
}

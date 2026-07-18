import { crudPost } from "@lib/dao/post/crud"
import { crudPostMedia } from "@lib/dao/postMedia/crud"
import { fetchPostMedia } from "@lib/dao/postMedia/fetch"
import { db } from "@template-nextjs/db"
import { enqueueVideoHlsEncode, type JobPayloadMap } from "@utils/queues"
import { deleteFromS3, existsOnS3 } from "@utils/aws"
import type { Job } from "bullmq"

export async function processMediaCleanup(job: Job<JobPayloadMap["media-cleanup"]>): Promise<void> {
  const { postId } = job.data

  const media = await fetchPostMedia(db).getManyByPost(postId, [
    "id",
    "s3Key",
    "uploadStatus",
    "mimeType",
  ])
  if (media.length === 0) return

  const pending = media.filter((m) => m.uploadStatus === "pending")
  if (pending.length === 0) return

  const scheduledDelay = job.opts.delay ?? 0
  const scheduledFor = job.timestamp + scheduledDelay
  const processedAt = job.processedOn ?? Date.now()
  const wasPromoted = processedAt + 1000 < scheduledFor

  if (wasPromoted) {
    const checks = await Promise.all(
      pending.map(async (m) => ({ media: m, exists: await existsOnS3(m.s3Key) })),
    )
    const surviving = checks.filter((c) => c.exists).map((c) => c.media)
    if (surviving.length > 0) {
      await crudPostMedia(db).markCompleted(
        postId,
        surviving.map((m) => ({ s3Key: m.s3Key })),
      )
      // Videos get an HLS ladder encoded in the background once the raw upload is
      // confirmed. This is the only place video rows transition to "completed".
      for (const m of surviving) {
        if (!m.mimeType?.startsWith("video/")) continue
        await crudPostMedia(db).updateHls(m.id, { hlsStatus: "pending" })
        await enqueueVideoHlsEncode(m.id)
      }
    }
    await crudPostMedia(db).deletePendingByPost(postId)
    return
  }

  await Promise.all(
    pending.map(async (m) => {
      try {
        await deleteFromS3(m.s3Key)
      } catch (err: unknown) {
        console.error(`[media-cleanup] failed to delete orphan ${m.s3Key}`, err)
      }
    }),
  )
  await crudPostMedia(db).deletePendingByPost(postId)

  const remaining = await fetchPostMedia(db).countCompletedByPost(postId)
  if (remaining === 0) await crudPost(db).deleteById(postId)
}

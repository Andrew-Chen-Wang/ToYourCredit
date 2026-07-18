import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import { crudPostMedia } from "@lib/dao/postMedia/crud"
import { fetchPostMedia } from "@lib/dao/postMedia/fetch"
import { db } from "@template-nextjs/db"
import { getObjectStreamFromS3, putObjectToS3 } from "@utils/aws"
import type { JobPayloadMap } from "@utils/queues"

const SEGMENT_SECONDS = 6

interface Rendition {
  name: string
  height: number
  videoBitrateK: number
  audioBitrateK: number
}

const RENDITIONS: Rendition[] = [
  { name: "720p", height: 720, videoBitrateK: 3000, audioBitrateK: 128 },
  { name: "480p", height: 480, videoBitrateK: 1200, audioBitrateK: 96 },
]

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-2000)}`))
    })
  })
}

interface ProbeResult {
  width: number
  height: number
  durationSeconds: number | null
}

async function probeVideo(filePath: string): Promise<ProbeResult> {
  const stdout = await run("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    filePath,
  ])
  const parsed = JSON.parse(stdout) as {
    streams?: { codec_type?: string; width?: number; height?: number }[]
    format?: { duration?: string }
  }
  const videoStream = parsed.streams?.find((s) => s.codec_type === "video")
  if (!videoStream?.width || !videoStream.height) {
    throw new Error(`ffprobe found no video stream in ${filePath}`)
  }
  const duration = parsed.format?.duration ? Number(parsed.format.duration) : null
  return {
    width: videoStream.width,
    height: videoStream.height,
    durationSeconds: Number.isFinite(duration) ? duration : null,
  }
}

// Even-numbered width for the given target height, preserving aspect ratio (libx264
// requires even dimensions).
function scaledWidth(source: ProbeResult, targetHeight: number): number {
  return Math.max(2, Math.round((source.width * targetHeight) / source.height / 2) * 2)
}

async function encodeRendition(
  sourcePath: string,
  outDir: string,
  rendition: Rendition,
): Promise<void> {
  await run("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-vf",
    `scale=-2:${rendition.height}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-b:v",
    `${rendition.videoBitrateK}k`,
    "-maxrate",
    `${Math.round(rendition.videoBitrateK * 1.2)}k`,
    "-bufsize",
    `${rendition.videoBitrateK * 2}k`,
    "-c:a",
    "aac",
    "-b:a",
    `${rendition.audioBitrateK}k`,
    "-ac",
    "2",
    "-hls_time",
    String(SEGMENT_SECONDS),
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    path.join(outDir, `${rendition.name}_%03d.ts`),
    path.join(outDir, `${rendition.name}.m3u8`),
  ])
}

function masterPlaylist(source: ProbeResult, renditions: Rendition[]): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
  for (const r of renditions) {
    const bandwidth = (r.videoBitrateK + r.audioBitrateK) * 1000
    const resolution = `${scaledWidth(source, r.height)}x${r.height}`
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}`)
    lines.push(`${r.name}.m3u8`)
  }
  return `${lines.join("\n")}\n`
}

function contentTypeFor(fileName: string): string {
  if (fileName.endsWith(".m3u8")) return "application/vnd.apple.mpegurl"
  if (fileName.endsWith(".ts")) return "video/mp2t"
  return "application/octet-stream"
}

export async function processVideoHlsEncode(
  data: JobPayloadMap["video-hls-encode"],
): Promise<void> {
  const { postMediaId } = data

  const row = await fetchPostMedia(db).getOne(postMediaId, [
    "id",
    "postId",
    "mediaType",
    "mimeType",
    "s3Key",
    "hlsStatus",
  ])
  if (!row) {
    console.warn(`[video-hls-encode] postMedia ${postMediaId} not found, skipping`)
    return
  }
  if (row.mediaType !== "video") {
    console.warn(`[video-hls-encode] postMedia ${postMediaId} is not a video, skipping`)
    return
  }
  if (row.hlsStatus === "ready") {
    console.info(`[video-hls-encode] postMedia ${postMediaId} already encoded, skipping`)
    return
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "video-hls-"))
  try {
    const sourceExt = path.extname(row.s3Key) || ".mp4"
    const sourcePath = path.join(tempDir, `source${sourceExt}`)
    const sourceStream = await getObjectStreamFromS3(row.s3Key)
    await pipeline(sourceStream, createWriteStream(sourcePath))

    const probe = await probeVideo(sourcePath)
    console.info(
      `[video-hls-encode] ${postMediaId}: ${probe.width}x${probe.height}, ` +
        `${probe.durationSeconds ?? "?"}s`,
    )

    // Skip renditions taller than the source; when the source is smaller than every
    // ladder step, encode a single rendition at the source height instead.
    let renditions = RENDITIONS.filter((r) => r.height <= probe.height)
    if (renditions.length === 0) {
      const low = RENDITIONS[RENDITIONS.length - 1]
      renditions = [{ ...low, name: `${probe.height}p`, height: probe.height }]
    }

    const outDir = path.join(tempDir, "out")
    await mkdir(outDir)
    for (const rendition of renditions) {
      await encodeRendition(sourcePath, outDir, rendition)
    }
    await writeFile(path.join(outDir, "master.m3u8"), masterPlaylist(probe, renditions))

    const keyPrefix = `post-media/${row.postId}/hls/${row.id}`
    const files = await readdir(outDir)
    for (const file of files) {
      const body = await readFile(path.join(outDir, file))
      await putObjectToS3(`${keyPrefix}/${file}`, body, contentTypeFor(file))
    }

    await crudPostMedia(db).updateHls(row.id, {
      hlsStatus: "ready",
      hlsMasterKey: `${keyPrefix}/master.m3u8`,
    })
  } catch (err: unknown) {
    console.error(`[video-hls-encode] failed for postMedia ${postMediaId}`, err)
    await crudPostMedia(db)
      .updateHls(row.id, { hlsStatus: "failed" })
      .catch((updateErr: unknown) => {
        console.error(`[video-hls-encode] failed to mark ${postMediaId} as failed`, updateErr)
      })
    throw err
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

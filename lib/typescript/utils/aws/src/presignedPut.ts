import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getS3BucketName, publicMediaUrl, s3Client } from "./client"

const IMAGE_CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

const IMAGE_MAX_BYTES = 20 * 1024 * 1024
const VIDEO_MAX_BYTES = 1024 * 1024 * 1024

const MEDIA_CONTENT_TYPE_TO_EXT: Record<string, string> = {
  ...IMAGE_CONTENT_TYPE_TO_EXT,
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

const MEDIA_CONTENT_TYPE_TO_MAX_BYTES: Record<string, number> = {
  "image/png": IMAGE_MAX_BYTES,
  "image/jpeg": IMAGE_MAX_BYTES,
  "image/gif": IMAGE_MAX_BYTES,
  "image/webp": IMAGE_MAX_BYTES,
  "video/mp4": VIDEO_MAX_BYTES,
  "video/quicktime": VIDEO_MAX_BYTES,
  "video/webm": VIDEO_MAX_BYTES,
}

const UPLOAD_EXPIRY_SECONDS = 30 * 60

export function getExtensionForImageContentType(contentType: string): string | undefined {
  return IMAGE_CONTENT_TYPE_TO_EXT[contentType]
}

export function isAllowedImageType(contentType: string): boolean {
  return contentType in IMAGE_CONTENT_TYPE_TO_EXT
}

export function getExtensionForMediaContentType(contentType: string): string | undefined {
  return MEDIA_CONTENT_TYPE_TO_EXT[contentType]
}

export function isAllowedMediaType(contentType: string): boolean {
  return contentType in MEDIA_CONTENT_TYPE_TO_MAX_BYTES
}

export function getMediaMaxSize(contentType: string): number | undefined {
  return MEDIA_CONTENT_TYPE_TO_MAX_BYTES[contentType]
}

export interface PresignedUploadPut {
  url: string
  key: string
  publicUrl: string
}

// Presigns a PUT rather than a POST policy because Cloudflare R2 (the production S3
// backend) does not support S3 POST policies. A presigned PUT cannot enforce a maximum
// object size, so callers must validate the declared byteSize/mime BEFORE signing; the
// media-cleanup job remains the backstop for anything that slips through.
async function createUploadPut(key: string, contentType: string): Promise<PresignedUploadPut> {
  const command = new PutObjectCommand({
    Bucket: getS3BucketName(),
    Key: key,
    ContentType: contentType,
  })
  const url = await getSignedUrl(s3Client, command, {
    expiresIn: UPLOAD_EXPIRY_SECONDS,
    // Sign the content type so the upload must match what the caller declared.
    signableHeaders: new Set(["content-type"]),
  })

  return { url, key, publicUrl: publicMediaUrl(key) }
}

export async function createImageUploadPut(params: {
  key: string
  contentType: string
}): Promise<PresignedUploadPut> {
  if (!isAllowedImageType(params.contentType)) {
    throw new Error(`Unsupported image content type: ${params.contentType}`)
  }
  return createUploadPut(params.key, params.contentType)
}

export async function createMediaUploadPut(params: {
  key: string
  contentType: string
}): Promise<PresignedUploadPut> {
  if (!isAllowedMediaType(params.contentType)) {
    throw new Error(`Unsupported media content type: ${params.contentType}`)
  }
  return createUploadPut(params.key, params.contentType)
}

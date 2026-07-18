import type { Readable } from "node:stream"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getS3BucketName, s3Client } from "./client"

// Streams an object's body so large files (e.g. source videos for HLS encoding) never
// have to be buffered fully in memory.
export async function getObjectStreamFromS3(key: string): Promise<Readable> {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: getS3BucketName(), Key: key }))
  if (!res.Body) throw new Error(`S3 object ${key} has no body`)
  return res.Body as Readable
}

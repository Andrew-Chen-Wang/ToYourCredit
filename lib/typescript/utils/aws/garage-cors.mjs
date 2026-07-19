#!/usr/bin/env node
// Applies dev CORS rules to the Garage media bucket so browser uploads
// (presigned PUTs from the website/SPA origins) pass preflight.
// Run after bin/garage-init.sh: node lib/typescript/utils/aws/garage-cors.mjs
import { fileURLToPath } from "node:url"
import path from "node:path"
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3"
import dotenv from "dotenv"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(currentDir, "..", "..", "..", "..", ".env"), quiet: true })

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

const bucket = process.env.S3_BUCKET_NAME ?? "readit-media"

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          // Garage joins multiple origins into one (invalid) header value, which
          // browsers reject — so use a wildcard. Presigned PUTs send no cookies,
          // making * safe here; prod buckets configure their own origins.
          AllowedOrigins: ["*"],
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
)

console.log(`CORS rules applied to bucket ${bucket}`)

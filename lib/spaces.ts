import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: 'nyc3',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
})

const bucket = process.env.DO_SPACES_BUCKET!
const cdnBase = process.env.DO_SPACES_CDN!

export async function uploadToSpaces(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  }))
  return `${cdnBase}/${key}`
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  })
  return getSignedUrl(s3, command, { expiresIn: 3600 })
}

export async function deleteFromSpaces(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export function cdnUrl(key: string): string {
  return `${cdnBase}/${key}`
}

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    const region = process.env.AWS_REGION ?? "us-east-1";
    client = new S3Client({ region });
  }
  return client;
}

export function isS3Configured(): boolean {
  return !!process.env.S3_PHOTO_BUCKET;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Decode a base64 image data URL and upload it to S3 under
 * `photos/<sessionId>.<ext>`. Returns the public-read HTTPS URL.
 *
 * Caller is responsible for:
 *   - the bucket existing in the same region as AWS_REGION
 *   - a bucket policy that grants `s3:GetObject` on `photos/*` to `*`
 *     (otherwise the public card page can't load the photo)
 *   - a 30-day lifecycle rule on the `photos/` prefix to match the
 *     DynamoDB TTL
 */
export async function uploadPhoto(
  sessionId: string,
  dataUrl: string,
): Promise<string> {
  const bucket = process.env.S3_PHOTO_BUCKET;
  if (!bucket) {
    throw new Error("S3_PHOTO_BUCKET is not configured.");
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Photo must be a base64 image data URL.");
  }
  const [, mimeType, base64Data] = match;
  const ext = MIME_TO_EXT[mimeType.toLowerCase()] ?? "bin";
  const key = `photos/${sessionId}.${ext}`;
  const buffer = Buffer.from(base64Data, "base64");

  const region = process.env.AWS_REGION ?? "us-east-1";

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // 30 days — matches the Dynamo TTL on the row pointing at this object.
      CacheControl: "public, max-age=2592000, immutable",
    }),
  );

  // Use the path-style URL pattern that works in every region without
  // needing to know which AWS partition the bucket lives in.
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export function isReviewS3Configured(): boolean {
  return !!process.env.S3_REVIEW_BUCKET;
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

const REVIEW_MIME_TO_EXT: Record<string, string> = {
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/**
 * Generate a presigned PUT URL the browser can use to upload a review video
 * directly to S3. Avoids streaming the (typically 10–30 MB) blob through the
 * Lambda/Amplify origin.
 *
 * Caller is responsible for:
 *   - the bucket existing in the same region as AWS_REGION
 *   - CORS configured on the bucket to allow PUT from the kiosk origin
 *   - a bucket policy granting `s3:GetObject` on `reviews/*` to `*` so the
 *     emailed link is openable
 */
export async function presignReviewUpload(
  sessionId: string,
  contentType: string,
  expiresInSec = 600,
): Promise<{ uploadUrl: string; objectUrl: string; key: string }> {
  const bucket = process.env.S3_REVIEW_BUCKET;
  if (!bucket) {
    throw new Error("S3_REVIEW_BUCKET is not configured.");
  }

  const ext = REVIEW_MIME_TO_EXT[contentType.toLowerCase()] ?? "webm";
  const key = `reviews/${sessionId}.${ext}`;
  const region = process.env.AWS_REGION ?? "us-east-1";

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSec },
  );

  return {
    uploadUrl,
    objectUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
    key,
  };
}

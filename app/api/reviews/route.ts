import { NextResponse } from "next/server";
import { isReviewS3Configured, presignReviewUpload } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 30;

type CreateReviewBody = {
  sessionId?: string;
  contentType?: string;
};

const ALLOWED_TYPES = new Set(["video/webm", "video/mp4", "video/quicktime"]);

export async function POST(req: Request) {
  if (!isReviewS3Configured()) {
    return NextResponse.json(
      {
        error:
          "S3_REVIEW_BUCKET is not configured on the server. Set it in your Amplify (or local .env) environment variables.",
      },
      { status: 503 },
    );
  }

  let body: CreateReviewBody;
  try {
    body = (await req.json()) as CreateReviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }
  if (!body.contentType || !ALLOWED_TYPES.has(body.contentType)) {
    return NextResponse.json(
      { error: "Unsupported video contentType." },
      { status: 400 },
    );
  }

  try {
    const { uploadUrl, objectUrl, key } = await presignReviewUpload(
      body.sessionId,
      body.contentType,
    );
    return NextResponse.json({ uploadUrl, objectUrl, key });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not presign upload.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

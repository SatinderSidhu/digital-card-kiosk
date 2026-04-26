import { NextResponse } from "next/server";
import { isDbConfigured, saveSession } from "@/lib/db";
import { isS3Configured, uploadPhoto } from "@/lib/s3";
import type { CardDetails, TemplateId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type CreateSessionBody = {
  sessionId?: string;
  details?: CardDetails;
  template?: TemplateId;
  photoDataUrl?: string | null;
};

const VALID_TEMPLATES: TemplateId[] = [
  "aurora",
  "mono",
  "sunset",
  "neon",
  "forest",
  "noir",
];

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        error:
          "DYNAMODB_TABLE is not configured on the server. Set it in your Amplify (or local .env) environment variables.",
      },
      { status: 503 },
    );
  }

  let body: CreateSessionBody;
  try {
    body = (await req.json()) as CreateSessionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }
  if (!body.template || !VALID_TEMPLATES.includes(body.template)) {
    return NextResponse.json(
      { error: "Missing or invalid template." },
      { status: 400 },
    );
  }
  if (!body.details || typeof body.details !== "object") {
    return NextResponse.json({ error: "Missing details." }, { status: 400 });
  }

  // If a photo was captured, upload it to S3 first and store only the URL
  // in DynamoDB. Skipping the photo (Skip-photo button) is fine — we store
  // null and the public page renders the card without a portrait.
  let photoUrl: string | null = null;
  if (body.photoDataUrl) {
    if (!isS3Configured()) {
      return NextResponse.json(
        {
          error:
            "S3_PHOTO_BUCKET is not configured on the server. Set it in your Amplify (or local .env) environment variables.",
        },
        { status: 503 },
      );
    }
    try {
      photoUrl = await uploadPhoto(body.sessionId, body.photoDataUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Photo upload failed.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  try {
    await saveSession({
      id: body.sessionId,
      details: body.details,
      template: body.template,
      // Field name kept as `photoDataUrl` for diff continuity; contents are
      // an https URL pointing at S3 (or null if the user skipped the photo).
      photoDataUrl: photoUrl,
    });

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
    return NextResponse.json({
      url: `${origin.replace(/\/$/, "")}/c/${body.sessionId}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

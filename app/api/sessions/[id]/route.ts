import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSession, isDbConfigured, updateSession } from "@/lib/db";
import { isS3Configured, uploadCardImage, uploadPhoto } from "@/lib/s3";
import type { CardDetails, TemplateId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };

type UpdateBody = {
  editToken?: string;
  details?: CardDetails;
  template?: TemplateId;
  /** A new headshot as a base64 image data URL. Omit (undefined) to keep
   *  the current photo; pass null to remove it. */
  photoDataUrl?: string | null;
  /** A fresh rendered-card snapshot (jpeg/png data URL). Optional. */
  cardImageDataUrl?: string | null;
};

const VALID_TEMPLATES: TemplateId[] = [
  "aurora",
  "mono",
  "sunset",
  "neon",
  "forest",
  "noir",
];

function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** POST — apply a cardholder edit. Body must include a valid `editToken`. */
export async function POST(req: Request, { params }: Props) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_TABLE is not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.editToken || typeof body.editToken !== "string") {
    return NextResponse.json({ error: "Missing edit token." }, { status: 401 });
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

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }
  if (!session.editToken || !tokensMatch(body.editToken, session.editToken)) {
    return NextResponse.json({ error: "Invalid edit link." }, { status: 403 });
  }

  // Resolve the photo. `undefined` ⇒ keep current; `null` ⇒ remove;
  // a data URL ⇒ upload and replace.
  let photoUrl: string | null = session.photoDataUrl;
  if (body.photoDataUrl === null) {
    photoUrl = null;
  } else if (typeof body.photoDataUrl === "string" && body.photoDataUrl) {
    if (!isS3Configured()) {
      return NextResponse.json(
        { error: "S3_PHOTO_BUCKET is not configured." },
        { status: 503 },
      );
    }
    try {
      photoUrl = await uploadPhoto(id, body.photoDataUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Photo upload failed.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Re-render the card snapshot if the client sent one — keeps the
  // emailed image + OG unfurl in sync with the edit.
  let cardImageUrl: string | null = session.cardImageUrl ?? null;
  if (
    body.cardImageDataUrl &&
    typeof body.cardImageDataUrl === "string" &&
    isS3Configured()
  ) {
    try {
      cardImageUrl = await uploadCardImage(id, body.cardImageDataUrl);
    } catch (err) {
      console.warn("[session-update] card snapshot upload failed:", err);
    }
  }

  try {
    await updateSession(id, {
      details: body.details,
      template: body.template,
      photoDataUrl: photoUrl,
      cardImageUrl,
    });
    return NextResponse.json({ ok: true, photoDataUrl: photoUrl, cardImageUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save changes.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

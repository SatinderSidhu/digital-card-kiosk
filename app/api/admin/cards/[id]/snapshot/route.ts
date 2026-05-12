import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getSession, isDbConfigured, setSessionCardImage } from "@/lib/db";
import { isS3Configured, uploadCardImage } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = { cardImageDataUrl?: string };

/**
 * Persist a rendered-card snapshot for a session: uploads the data URL to
 * S3 (`cards/<id>.<ext>`) and patches `cardImageUrl` on the row. Called by
 * the admin card-detail page on load so the S3 image exists before the
 * operator sends an email — and so the public `/c/[id]` OG image is
 * populated for cards created before that column existed.
 */
export async function POST(req: Request, { params }: Props) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_TABLE is not configured." },
      { status: 503 },
    );
  }
  if (!isS3Configured()) {
    return NextResponse.json(
      { error: "S3_PHOTO_BUCKET is not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const dataUrl = body.cardImageDataUrl;
  if (!dataUrl || typeof dataUrl !== "string" || !/^data:image\/(jpeg|png);base64,/.test(dataUrl)) {
    return NextResponse.json(
      { error: "cardImageDataUrl must be a base64 image/jpeg or image/png data URL." },
      { status: 400 },
    );
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  try {
    const cardImageUrl = await uploadCardImage(id, dataUrl);
    try {
      await setSessionCardImage(id, cardImageUrl);
    } catch (err) {
      console.warn("[snapshot] cardImageUrl persist failed:", err);
    }
    return NextResponse.json({ ok: true, cardImageUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Snapshot upload failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

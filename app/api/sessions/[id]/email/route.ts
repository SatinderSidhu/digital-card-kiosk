import { NextResponse } from "next/server";
import { sendCardEmail, type CardEmailType } from "@/lib/send-card-email";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  email?: string;
  /** "card" (default) — the as-shared card email.
   *  "followup" — thank-you + share-tips + manage-your-card announcement.
   *  "image" — image-focused: big inline preview AND the card image
   *  attached as a downloadable file (in addition to the vCard). */
  type?: CardEmailType;
  /** Optional base64 image data URL — a fresh snapshot of the rendered
   *  card. Uploaded to S3 and referenced by URL in the body. */
  cardImageDataUrl?: string | null;
};

const VALID_TYPES: CardEmailType[] = ["card", "followup", "image"];

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestedType = body.type;
  const type: CardEmailType =
    requestedType && VALID_TYPES.includes(requestedType) ? requestedType : "card";

  const result = await sendCardEmail({
    id,
    email: (body.email ?? "").trim(),
    type,
    cardImageDataUrl:
      typeof body.cardImageDataUrl === "string" ? body.cardImageDataUrl : null,
  });

  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result.error }, { status: result.status });
}

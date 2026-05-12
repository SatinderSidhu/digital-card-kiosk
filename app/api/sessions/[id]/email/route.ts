import { NextResponse } from "next/server";
import { sendCardEmail, type CardEmailType } from "@/lib/send-card-email";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  email?: string;
  /** "card" (default) = the as-shared card email. "followup" = the
   *  thank-you + share-tips + manage-your-card announcement. */
  type?: CardEmailType;
  /** Optional base64 image data URL — a fresh snapshot of the rendered
   *  card. Uploaded to S3 and referenced by URL in the body. */
  cardImageDataUrl?: string | null;
};

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await sendCardEmail({
    id,
    email: (body.email ?? "").trim(),
    type: body.type === "followup" ? "followup" : "card",
    cardImageDataUrl:
      typeof body.cardImageDataUrl === "string" ? body.cardImageDataUrl : null,
  });

  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result.error }, { status: result.status });
}

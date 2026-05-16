import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getSession, isDbConfigured } from "@/lib/db";
import { sendCardEmail, type CardEmailType } from "@/lib/send-card-email";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  email?: string;
  /** "card" (default) re-sends the as-shared card email; "followup"
   *  sends the thank-you + share-tips + manage-your-card announcement;
   *  "image" sends an image-focused email with the card image attached
   *  as a downloadable file. */
  type?: CardEmailType;
  /** Optional base64 data URL (image/png or image/jpeg) — a fresh
   *  rendered-card snapshot captured on the admin detail page. */
  cardImageDataUrl?: string | null;
};

const VALID_TYPES: CardEmailType[] = ["card", "followup", "image"];

/**
 * Admin-triggered card email (resend / follow-up). Calls the shared
 * `sendCardEmail` helper directly — no internal HTTP fetch to the public
 * route (that loopback fails on Amplify with ERR_SSL_PACKET_LENGTH_TOO_LONG).
 * The operator can override the destination; default is the email on the
 * card itself.
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

  const { id } = await params;
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // empty body is allowed — fall back to the email on the card.
  }

  let target = body.email?.trim();
  if (!target) {
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }
    target = session.details.email;
  }
  if (!target) {
    return NextResponse.json(
      { error: "No email on this card and none provided." },
      { status: 400 },
    );
  }

  const requestedType = body.type;
  const type: CardEmailType =
    requestedType && VALID_TYPES.includes(requestedType) ? requestedType : "card";

  const result = await sendCardEmail({
    id,
    email: target,
    type,
    cardImageDataUrl:
      typeof body.cardImageDataUrl === "string" ? body.cardImageDataUrl : null,
  });

  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result.error }, { status: result.status });
}

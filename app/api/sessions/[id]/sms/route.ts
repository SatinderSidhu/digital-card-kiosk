import { NextResponse } from "next/server";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { getSession, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = { phone?: string };

/**
 * Normalise to E.164 (+ followed by digits). Bare 10-digit numbers are
 * assumed to be US/CA. Returns null if the number is too short to be real.
 */
function toE164(phone: string): string | null {
  const trimmed = phone.trim();
  const startsPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (startsPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(req: Request, { params }: Props) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_TABLE is not configured on the server." },
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
  const phone = body.phone?.trim();
  if (!phone) {
    return NextResponse.json(
      { error: "Phone number is required." },
      { status: 400 },
    );
  }
  const e164 = toE164(phone);
  if (!e164) {
    return NextResponse.json(
      { error: "Enter a valid phone number." },
      { status: 400 },
    );
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Card not found — was this session created?" },
      { status: 404 },
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const cardUrl = `${origin.replace(/\/$/, "")}/c/${id}`;
  const senderName = session.details.fullName || "Someone";
  // Keep under 160 chars so it stays a single SMS segment.
  const message = `${senderName} shared a digital card with you: ${cardUrl}`;

  try {
    const region = process.env.AWS_REGION ?? "us-east-1";
    const sns = new SNSClient({ region });
    await sns.send(
      new PublishCommand({
        PhoneNumber: e164,
        Message: message,
        MessageAttributes: {
          // Transactional → higher reliability + delivery priority than
          // Promotional. Costs the same.
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    let message = "SMS failed.";
    if (err instanceof Error) message = err.message;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

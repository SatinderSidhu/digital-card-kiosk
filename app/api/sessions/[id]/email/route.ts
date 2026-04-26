import { NextResponse } from "next/server";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { getSession, isDbConfigured } from "@/lib/db";
import { buildVcard } from "@/lib/vcard";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = { email?: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFilename(s: string): string {
  return (s || "contact").replace(/[^a-z0-9]+/gi, "_");
}

export async function POST(req: Request, { params }: Props) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    return NextResponse.json(
      {
        error:
          "SES_FROM_EMAIL is not configured on the server. Set it (and verify the address in SES) in your Amplify env vars.",
      },
      { status: 503 },
    );
  }
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
  const email = body.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
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
  const senderName = session.details.fullName || "your digital card";
  const subject = `Your digital card from ${senderName}`;
  const vcard = buildVcard(session.details, id);
  const vcardFilename = `${safeFilename(session.details.fullName)}.vcf`;

  const d = session.details;
  const html = `<!doctype html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f7fb;color:#1a1a2e;">
  <div style="max-width:540px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;color:#1a1a2e;">Your digital card</h1>
    <div style="background:linear-gradient(135deg,#1e1b4b,#312e81,#0c4a6e);border-radius:16px;padding:28px;color:white;">
      <p style="font-size:26px;font-weight:700;margin:0 0 4px;line-height:1.1;">${escapeHtml(d.fullName || "Your Name")}</p>
      <p style="font-size:16px;opacity:0.92;margin:0 0 4px;">${escapeHtml(d.title || "")}</p>
      <p style="font-size:14px;opacity:0.7;margin:0 0 16px;">${escapeHtml(d.company || "")}</p>
      <hr style="border:0;border-top:1px solid rgba(255,255,255,0.25);margin:0 0 16px;">
      ${d.phone ? `<p style="margin:6px 0;font-size:14px;">📞 ${escapeHtml(d.phone)}</p>` : ""}
      ${d.email ? `<p style="margin:6px 0;font-size:14px;">✉ ${escapeHtml(d.email)}</p>` : ""}
      ${d.website ? `<p style="margin:6px 0;font-size:14px;">🌐 ${escapeHtml(d.website)}</p>` : ""}
    </div>
    <div style="text-align:center;margin:28px 0 16px;">
      <a href="${cardUrl}" style="display:inline-block;background:#7c5cff;color:white;padding:12px 32px;border-radius:9999px;text-decoration:none;font-weight:600;">View on web</a>
    </div>
    <p style="font-size:13px;color:#64748b;text-align:center;margin:8px 0 0;">
      The .vcf file attached opens directly in your phone&apos;s Contacts app.
    </p>
  </div>
</body></html>`;

  const text = [
    `Your digital card from ${senderName}`,
    "",
    d.title ? d.title : "",
    d.company ? d.company : "",
    "",
    d.phone ? `Phone: ${d.phone}` : "",
    d.email ? `Email: ${d.email}` : "",
    d.website ? `Web:   ${d.website}` : "",
    "",
    `View on web: ${cardUrl}`,
    "",
    "(The .vcf attachment will open in your Contacts app.)",
  ]
    .filter(Boolean)
    .join("\n");

  const outerBoundary = `----digital-card-outer-${Math.random().toString(36).slice(2)}`;
  const innerBoundary = `----digital-card-inner-${Math.random().toString(36).slice(2)}`;

  const rawMessage = [
    `From: ${fromEmail}`,
    `To: ${email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    ``,
    `--${outerBoundary}`,
    `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
    ``,
    `--${innerBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    text,
    ``,
    `--${innerBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    html,
    ``,
    `--${innerBoundary}--`,
    ``,
    `--${outerBoundary}`,
    `Content-Type: text/vcard; charset=UTF-8; name="${vcardFilename}"`,
    `Content-Disposition: attachment; filename="${vcardFilename}"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    vcard,
    ``,
    `--${outerBoundary}--`,
  ].join("\r\n");

  try {
    const region = process.env.AWS_REGION ?? "us-east-1";
    const ses = new SESClient({ region });
    await ses.send(
      new SendRawEmailCommand({
        RawMessage: { Data: new TextEncoder().encode(rawMessage) },
      }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    let message = "Email failed.";
    if (err instanceof Error) message = err.message;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { getSession, isDbConfigured } from "@/lib/db";
import { buildVcard } from "@/lib/vcard";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  email?: string;
  /** Optional base64 PNG data URL — a snapshot of the rendered card. */
  cardImageDataUrl?: string | null;
};

/** Wrap a base64 string at 76 chars per RFC 2045 so picky MTAs don't
 *  reject the message for over-long lines. */
function wrapBase64(s: string): string {
  return s.match(/.{1,76}/g)?.join("\r\n") ?? s;
}

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

  // Optional PNG snapshot. Reject anything that's not a real image data
  // URL so a malicious payload can't piggy-back arbitrary bytes onto an
  // email we're sending from a verified sender.
  let cardImageBase64: string | null = null;
  if (body.cardImageDataUrl && typeof body.cardImageDataUrl === "string") {
    const m = body.cardImageDataUrl.match(/^data:image\/png;base64,([\s\S]+)$/);
    if (m) cardImageBase64 = m[1];
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
  const subject = `Your digital card${senderName !== "your digital card" ? `, ${senderName}` : ""}`;
  const vcard = buildVcard(session.details, id);
  const vcardFilename = `${safeFilename(session.details.fullName)}.vcf`;

  const d = session.details;
  const firstName = (d.fullName || "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  // The cid lets the inline-attached PNG render in the body via
  // <img src="cid:...">. Most clients (Gmail, Outlook, Apple Mail) also
  // list the cid'd image in the attachments tray.
  const cardImageCid = `digital-card-${id}`;

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f7fb;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px -12px rgba(15,23,42,0.12);">
          <tr>
            <td style="padding:32px 32px 12px;">
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(greeting)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.55;color:#475569;">
                Here's your digital card. Open it on the web for the QR and live links, or save the <strong>.vcf</strong> attachment to add yourself to anyone's Contacts in one tap. The card image is also attached so you can share or print it.
              </p>
            </td>
          </tr>
${
  cardImageBase64
    ? `          <tr>
            <td align="center" style="padding:20px 32px 8px;">
              <img src="cid:${cardImageCid}" alt="${escapeHtml(d.fullName || "Your digital card")}" style="display:block;max-width:100%;width:100%;height:auto;border-radius:14px;" />
            </td>
          </tr>`
    : `          <tr>
            <td style="padding:16px 32px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#1e1b4b,#312e81 50%,#0c4a6e);border-radius:14px;color:#ffffff;">
                <tr><td style="padding:24px 28px;color:#ffffff;">
                  <p style="margin:0 0 4px;font-size:24px;font-weight:700;line-height:1.1;color:#ffffff;">${escapeHtml(d.fullName || "Your Name")}</p>
                  <p style="margin:0 0 4px;font-size:15px;color:rgba(255,255,255,0.92);">${escapeHtml(d.title || "")}</p>
                  <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.7);">${escapeHtml(d.company || "")}</p>
                  <hr style="border:0;border-top:1px solid rgba(255,255,255,0.25);margin:0 0 14px;">
                  ${d.phone ? `<p style="margin:6px 0;font-size:14px;color:#ffffff;">📞 ${escapeHtml(d.phone)}</p>` : ""}
                  ${d.email ? `<p style="margin:6px 0;font-size:14px;color:#ffffff;">✉ ${escapeHtml(d.email)}</p>` : ""}
                  ${d.website ? `<p style="margin:6px 0;font-size:14px;color:#ffffff;">🌐 ${escapeHtml(d.website)}</p>` : ""}
                </td></tr>
              </table>
            </td>
          </tr>`
}
          <tr>
            <td align="center" style="padding:20px 32px 8px;">
              <a href="${escapeHtml(cardUrl)}" style="display:inline-block;background:#7c5cff;background-image:linear-gradient(135deg,#7c5cff 0%,#22d3ee 100%);color:#ffffff;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">View on web</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                ${cardImageBase64 ? "A <strong>.png</strong> of the card and a <strong>.vcf</strong> contact file are attached." : "The <strong>.vcf</strong> file attached opens directly in your phone's Contacts app."}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    greeting,
    "",
    "Here's your digital card. Open it on the web for the QR and live links,",
    "or save the .vcf attachment to add yourself to anyone's Contacts.",
    "",
    `View on web: ${cardUrl}`,
    "",
    cardImageBase64
      ? "Attached: card.png (image) and .vcf (contact)."
      : "Attached: .vcf (contact).",
  ]
    .filter(Boolean)
    .join("\n");

  const outerBoundary = `----digital-card-outer-${Math.random().toString(36).slice(2)}`;
  const innerBoundary = `----digital-card-inner-${Math.random().toString(36).slice(2)}`;
  const relatedBoundary = `----digital-card-related-${Math.random().toString(36).slice(2)}`;
  const cardImageFilename = `${safeFilename(session.details.fullName)}-card.png`;

  // MIME shape (with PNG):
  //   multipart/mixed
  //   ├── multipart/related
  //   │   ├── multipart/alternative (text + html)
  //   │   └── image/png            (inline, Content-ID — referenced by html)
  //   ├── text/vcard               (attachment)
  //   └── image/png                (attachment — explicit second copy so the
  //                                 client lists it in the attachments tray)
  // Without PNG: just outer/mixed → alternative + vCard.
  const altBlock = [
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
  ].join("\r\n");

  const parts: string[] = [
    `From: ${fromEmail}`,
    `To: ${email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    ``,
    `--${outerBoundary}`,
  ];

  if (cardImageBase64) {
    parts.push(
      `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
      ``,
      `--${relatedBoundary}`,
      altBlock,
      ``,
      `--${relatedBoundary}`,
      `Content-Type: image/png; name="${cardImageFilename}"`,
      `Content-Disposition: inline; filename="${cardImageFilename}"`,
      `Content-ID: <${cardImageCid}>`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapBase64(cardImageBase64),
      ``,
      `--${relatedBoundary}--`,
      ``,
    );
  } else {
    parts.push(altBlock, ``);
  }

  parts.push(
    `--${outerBoundary}`,
    `Content-Type: text/vcard; charset=UTF-8; name="${vcardFilename}"`,
    `Content-Disposition: attachment; filename="${vcardFilename}"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    vcard,
    ``,
  );

  if (cardImageBase64) {
    parts.push(
      `--${outerBoundary}`,
      `Content-Type: image/png; name="${cardImageFilename}"`,
      `Content-Disposition: attachment; filename="${cardImageFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapBase64(cardImageBase64),
      ``,
    );
  }

  parts.push(`--${outerBoundary}--`);
  const rawMessage = parts.join("\r\n");

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

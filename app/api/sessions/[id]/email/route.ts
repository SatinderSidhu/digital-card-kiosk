import { NextResponse } from "next/server";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { getSession, isDbConfigured, setSessionCardImage } from "@/lib/db";
import { isS3Configured, uploadCardImage } from "@/lib/s3";
import { buildVcard } from "@/lib/vcard";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  email?: string;
  /** Optional base64 PNG data URL — a snapshot of the rendered card. */
  cardImageDataUrl?: string | null;
};


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

  // Optional card snapshot. Accept JPEG (preferred — much smaller) or
  // PNG. We don't attach it to the email anymore — it gets uploaded to
  // S3 below, and the public URL is embedded in the body. Keeps SES
  // raw-message + Lambda payload size flat regardless of how heavy the
  // card is.
  const cardImageDataUrl =
    body.cardImageDataUrl && typeof body.cardImageDataUrl === "string"
      ? body.cardImageDataUrl
      : null;

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

  // Upload the rendered-card snapshot to S3 (if we got one) so the email
  // can reference it as a public URL instead of inlining base64. This
  // sidesteps the Lambda 6 MB sync request limit + SES 10 MB raw-message
  // cap entirely. We also persist the URL on the session row so the
  // public /c/[id] page can use it as the OpenGraph image.
  let cardImageUrl: string | null = session.cardImageUrl ?? null;
  if (cardImageDataUrl && isS3Configured()) {
    try {
      cardImageUrl = await uploadCardImage(id, cardImageDataUrl);
      // Best-effort DB update — if it fails, the email still goes out
      // and OG falls back to the default site image. Log and move on.
      try {
        await setSessionCardImage(id, cardImageUrl);
      } catch (err) {
        console.warn("[email] cardImageUrl persist failed:", err);
      }
    } catch (err) {
      console.warn("[email] card snapshot S3 upload failed:", err);
    }
  }

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
                Here's your digital card. Open it on the web for the QR and live links, or save the <strong>.vcf</strong> attachment to add yourself to anyone's Contacts in one tap.
              </p>
            </td>
          </tr>
${
  cardImageUrl
    ? `          <tr>
            <td align="center" style="padding:20px 32px 8px;">
              <a href="${escapeHtml(cardImageUrl)}" style="display:block;text-decoration:none;">
                <img src="${escapeHtml(cardImageUrl)}" alt="${escapeHtml(d.fullName || "Your digital card")}" style="display:block;max-width:100%;width:100%;height:auto;border-radius:14px;" />
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 0;">
              <a href="${escapeHtml(cardImageUrl)}" style="display:inline-block;color:#7c5cff;font-size:13px;font-weight:500;text-decoration:none;">
                Save image to your phone →
              </a>
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
                The <strong>.vcf</strong> file attached opens directly in your phone's Contacts app.${cardImageUrl ? " Tap the card image above to save it to your phone." : ""}
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
    cardImageUrl ? `\nSave the card image: ${cardImageUrl}` : "",
    "",
    "Attached: .vcf (contact).",
  ]
    .filter(Boolean)
    .join("\n");

  // MIME shape: multipart/mixed → multipart/alternative + text/vcard.
  // The card image is hosted on S3 and referenced by URL in the HTML —
  // it's no longer attached, so the email stays under ~10 KB regardless
  // of card complexity. No more Lambda OOMs / SES "message too large".
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
  const rawBytes = new TextEncoder().encode(rawMessage);

  try {
    const region = process.env.AWS_REGION ?? "us-east-1";
    const ses = new SESClient({ region });
    await ses.send(
      new SendRawEmailCommand({ RawMessage: { Data: rawBytes } }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Surface the SES error name/code so 400 vs 500 is distinguishable in
    // CloudWatch (sandbox-not-verified vs throttled vs payload size etc.).
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : "Email failed.";
    console.error(
      `[email] SES send failed (${name}): ${message} — raw size ${rawBytes.byteLength} bytes`,
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

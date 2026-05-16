import { randomBytes } from "crypto";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import {
  getSession,
  isDbConfigured,
  setSessionCardImage,
  setSessionEditToken,
} from "./db";
import { isS3Configured, uploadCardImage } from "./s3";
import { buildVcard } from "./vcard";
import type { CardDetails } from "./types";

export type CardEmailType = "card" | "followup" | "image";

export type SendCardEmailResult =
  | { ok: true; cardImageUrl: string | null }
  | { ok: false; error: string; status: number };

type SendCardEmailOpts = {
  id: string;
  email: string;
  type?: CardEmailType;
  /** Fresh rendered-card snapshot as a base64 data URL (jpeg/png).
   *  Uploaded to S3 and referenced by URL in the email body. */
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

const SHELL_OPEN = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f7fb;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px -12px rgba(15,23,42,0.12);">`;
const SHELL_CLOSE = `      </table>
    </td></tr>
  </table>
</body>
</html>`;

/** The card-preview block: an <img> sourced from the S3-hosted snapshot.
 *  If there's no snapshot, render nothing — the email keeps the "View on
 *  web" button which opens the live card, and we never reconstruct the
 *  card in HTML (it never matched the real design and rendered blank when
 *  details were sparse). The admin detail page proactively captures +
 *  uploads a snapshot on load, so most cards have one; the kiosk
 *  auto-send uploads one too. */
function previewBlock(cardImageUrl: string | null, fullName: string): string {
  if (!cardImageUrl) return "";
  return `          <tr>
            <td align="center" style="padding:20px 32px 6px;">
              <a href="${escapeHtml(cardImageUrl)}" style="display:block;text-decoration:none;">
                <img src="${escapeHtml(cardImageUrl)}" alt="${escapeHtml(fullName || "Your digital card")}" style="display:block;max-width:100%;width:100%;height:auto;border-radius:14px;" />
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:6px 32px 0;">
              <a href="${escapeHtml(cardImageUrl)}" style="display:inline-block;color:#7c5cff;font-size:13px;font-weight:500;text-decoration:none;">Save image to your phone →</a>
            </td>
          </tr>`;
}

function buildEmailBody(a: {
  type: CardEmailType;
  senderName: string;
  greeting: string;
  cardUrl: string;
  manageUrl: string | null;
  cardImageUrl: string | null;
  details: CardDetails;
}): { subject: string; html: string; text: string } {
  const { type, senderName, greeting, cardUrl, manageUrl, cardImageUrl, details } = a;
  const manageBtn = manageUrl
    ? `          <tr>
            <td align="center" style="padding:8px 32px 0;">
              <a href="${escapeHtml(manageUrl)}" style="display:inline-block;color:#7c5cff;font-size:13px;font-weight:500;text-decoration:none;">Manage your card — edit details, photo, or template →</a>
            </td>
          </tr>`
    : "";
  const viewBtn = `          <tr>
            <td align="center" style="padding:20px 32px 4px;">
              <a href="${escapeHtml(cardUrl)}" style="display:inline-block;background:#7c5cff;background-image:linear-gradient(135deg,#7c5cff 0%,#22d3ee 100%);color:#ffffff;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">View on web</a>
            </td>
          </tr>`;

  if (type === "image") {
    const subject = "Your digital card — image copy";
    const html = `${SHELL_OPEN}
          <tr>
            <td style="padding:32px 32px 8px;">
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(greeting)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.55;color:#475569;">
                Here's a downloadable copy of your digital card. Tap the image to save it to your phone, drop it in your email signature, or share it anywhere — it's also attached to this email.
              </p>
            </td>
          </tr>
${previewBlock(cardImageUrl, details.fullName)}
${viewBtn}
${manageBtn}
          <tr>
            <td style="padding:16px 32px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                The card image is attached as a downloadable file${manageUrl ? ", and the manage link above is private — anyone with it can edit your card" : ""}.
              </p>
            </td>
          </tr>
${SHELL_CLOSE}`;
    const text = [
      greeting,
      "",
      "Here's a downloadable copy of your digital card.",
      "Tap the image attachment to save it, or open the link below:",
      "",
      cardImageUrl ? `Image: ${cardImageUrl}` : "(image unavailable)",
      "",
      `View on web: ${cardUrl}`,
      manageUrl ? `Manage your card (private link): ${manageUrl}` : "",
      "",
      "Attached: card.jpg (image).",
    ]
      .filter(Boolean)
      .join("\n");
    return { subject, html, text };
  }

  if (type === "followup") {
    const subject = "Your digital card — share it and make it yours";
    const html = `${SHELL_OPEN}
          <tr>
            <td style="padding:32px 32px 8px;">
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(greeting)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.55;color:#475569;">
                Thank you so much for creating your digital card! Here's a quick recap — plus, you can now <strong>manage and update it</strong> any time.
              </p>
            </td>
          </tr>
${previewBlock(cardImageUrl, details.fullName)}
          <tr>
            <td style="padding:22px 32px 6px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Share it with the world</p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#475569;">
                Your card lives at a permanent link you can share anywhere — drop it in your email signature, add the QR to your slides, or let people scan it at events.
              </p>
            </td>
          </tr>
${viewBtn}
          <tr>
            <td style="padding:22px 32px 6px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Make it yours</p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#475569;">
                You can now edit your card any time — update your name, title, company, phone, email, or website; swap to a different design; or re-take your photo (with AI studio polish if you want it).
              </p>
            </td>
          </tr>
${manageBtn}
          <tr>
            <td style="padding:16px 32px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                The <strong>.vcf</strong> file attached opens directly in your phone's Contacts app.${manageUrl ? " Keep the manage link private — anyone with it can edit your card." : ""}
              </p>
            </td>
          </tr>
${SHELL_CLOSE}`;
    const text = [
      greeting,
      "",
      "Thank you so much for creating your digital card!",
      "",
      cardImageUrl ? `Card image: ${cardImageUrl}` : "",
      "",
      "SHARE IT WITH THE WORLD",
      "Your card lives at a permanent link you can share anywhere:",
      cardUrl,
      "",
      "MAKE IT YOURS",
      "You can now edit your card any time — details, design, photo:",
      manageUrl ? manageUrl : "(manage link unavailable)",
      manageUrl ? "Keep this link private — anyone with it can edit your card." : "",
      "",
      "Attached: .vcf (contact).",
    ]
      .filter(Boolean)
      .join("\n");
    return { subject, html, text };
  }

  // type === "card"
  const subject = `Your digital card${senderName !== "your digital card" ? `, ${senderName}` : ""}`;
  const html = `${SHELL_OPEN}
          <tr>
            <td style="padding:32px 32px 12px;">
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(greeting)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.55;color:#475569;">
                Here's your digital card. Open it on the web for the QR and live links, or save the <strong>.vcf</strong> attachment to add yourself to anyone's Contacts in one tap.
              </p>
            </td>
          </tr>
${previewBlock(cardImageUrl, details.fullName)}
${viewBtn}
${manageBtn}
          <tr>
            <td style="padding:16px 32px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                The <strong>.vcf</strong> file attached opens directly in your phone's Contacts app.${cardImageUrl ? " Tap the card image above to save it to your phone." : ""}${manageUrl ? " The manage link is private — anyone with it can edit your card." : ""}
              </p>
            </td>
          </tr>
${SHELL_CLOSE}`;
  const text = [
    greeting,
    "",
    "Here's your digital card. Open it on the web for the QR and live links,",
    "or save the .vcf attachment to add yourself to anyone's Contacts.",
    "",
    `View on web: ${cardUrl}`,
    cardImageUrl ? `Save the card image: ${cardImageUrl}` : "",
    manageUrl ? `Manage your card (private link): ${manageUrl}` : "",
    "",
    "Attached: .vcf (contact).",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

/**
 * Build and send a card email via SES. Shared by the public
 * `/api/sessions/[id]/email` route and the admin resend / follow-up
 * proxy — calling this directly (rather than the admin route doing an
 * internal HTTP fetch to the public route) avoids a loopback request
 * that fails on Amplify with ERR_SSL_PACKET_LENGTH_TOO_LONG.
 *
 * `siteUrl` should be the public origin (NEXT_PUBLIC_SITE_URL); the
 * email body never has the server fetch it — it's just put into links.
 */
export async function sendCardEmail(
  opts: SendCardEmailOpts,
): Promise<SendCardEmailResult> {
  const { id, email, type = "card", cardImageDataUrl = null } = opts;

  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    return {
      ok: false,
      status: 503,
      error:
        "SES_FROM_EMAIL is not configured on the server. Set it (and verify the address in SES) in your env vars.",
    };
  }
  if (!isDbConfigured()) {
    return { ok: false, status: 503, error: "DYNAMODB_TABLE is not configured." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: "Enter a valid email address." };
  }

  const session = await getSession(id);
  if (!session) {
    return { ok: false, status: 404, error: "Card not found — was this session created?" };
  }

  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const cardUrl = `${origin}/c/${id}`;

  // Ensure the row has an edit token so we can hand out a manage link.
  let editToken = session.editToken ?? null;
  if (!editToken) {
    editToken = randomBytes(24).toString("base64url");
    try {
      await setSessionEditToken(id, editToken);
    } catch (err) {
      console.warn("[email] editToken backfill failed:", err);
      editToken = null;
    }
  }
  const manageUrl = editToken
    ? `${cardUrl}/edit?t=${encodeURIComponent(editToken)}`
    : null;

  const d = session.details;
  const senderName = d.fullName || "your digital card";
  const firstName = (d.fullName || "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const vcard = buildVcard(d, id);
  const vcardFilename = `${safeFilename(d.fullName)}.vcf`;

  // Upload the rendered-card snapshot to S3 so the email references it
  // by URL instead of inlining base64 — keeps the message tiny.
  let cardImageUrl: string | null = session.cardImageUrl ?? null;
  if (cardImageDataUrl && typeof cardImageDataUrl === "string" && isS3Configured()) {
    try {
      cardImageUrl = await uploadCardImage(id, cardImageDataUrl);
      try {
        await setSessionCardImage(id, cardImageUrl);
      } catch (err) {
        console.warn("[email] cardImageUrl persist failed:", err);
      }
    } catch (err) {
      console.warn("[email] card snapshot S3 upload failed:", err);
    }
  }

  // For the image-only email type the customer expects the card image
  // to land in their email client's attachment tray (not just inline) so
  // it's one tap to save / share / print. Fetch the bytes from S3
  // server-side and attach as an image/jpeg (or png) MIME part.
  let imageAttachment: { mime: string; filename: string; base64: string } | null =
    null;
  if (type === "image") {
    if (!cardImageUrl) {
      return {
        ok: false,
        status: 409,
        error:
          "Card image isn't ready yet. Open the card once on the kiosk or the admin page so it gets snapshotted, then try again.",
      };
    }
    try {
      const res = await fetch(cardImageUrl);
      if (!res.ok) throw new Error(`fetch ${cardImageUrl} → ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      const ext = mime === "image/png" ? "png" : "jpg";
      imageAttachment = {
        mime,
        filename: `${safeFilename(d.fullName)}-card.${ext}`,
        base64: buf.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "",
      };
    } catch (err) {
      console.warn("[email] image attachment fetch failed:", err);
      // Fall through — the inline <img> still works, attachment just
      // won't appear. Better than failing the send.
    }
  }

  const { subject, html, text } = buildEmailBody({
    type,
    senderName,
    greeting,
    cardUrl,
    manageUrl,
    cardImageUrl,
    details: d,
  });

  const outerBoundary = `----digital-card-outer-${Math.random().toString(36).slice(2)}`;
  const innerBoundary = `----digital-card-inner-${Math.random().toString(36).slice(2)}`;
  const parts: string[] = [
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
  ];
  if (imageAttachment) {
    parts.push(
      `--${outerBoundary}`,
      `Content-Type: ${imageAttachment.mime}; name="${imageAttachment.filename}"`,
      `Content-Disposition: attachment; filename="${imageAttachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      imageAttachment.base64,
      ``,
    );
  }
  parts.push(`--${outerBoundary}--`);
  const rawMessage = parts.join("\r\n");
  const rawBytes = new TextEncoder().encode(rawMessage);

  try {
    const region = process.env.AWS_REGION ?? "us-east-1";
    const ses = new SESClient({ region });
    await ses.send(new SendRawEmailCommand({ RawMessage: { Data: rawBytes } }));
    return { ok: true, cardImageUrl };
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : "Email failed.";
    console.error(
      `[email] SES send failed (${name}): ${message} — raw size ${rawBytes.byteLength} bytes`,
    );
    return { ok: false, status: 502, error: message };
  }
}

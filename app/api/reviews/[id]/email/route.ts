import { NextResponse } from "next/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { isReviewsDbConfigured, saveReview } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  email?: string;
  name?: string;
  title?: string;
  videoUrl?: string;
  videoMimeType?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  const { id } = await params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim();
  const rawName = body.name?.trim() ?? "";
  const name = rawName || "there";
  const title = body.title?.trim() ?? "";
  const videoUrl = body.videoUrl?.trim();
  const videoMimeType = body.videoMimeType?.trim() ?? "video/webm";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (!videoUrl || !/^https?:\/\//.test(videoUrl)) {
    return NextResponse.json({ error: "Missing video URL." }, { status: 400 });
  }

  const subject = "Thanks for your video review";
  const html = `<!doctype html><html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f7fb;color:#1a1a2e;">
  <div style="max-width:540px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;color:#1a1a2e;">Thanks, ${escapeHtml(name)}!</h1>
    <p style="font-size:15px;color:#475569;margin:0 0 20px;line-height:1.5;">
      Your video review has been recorded. You can replay it any time using the link below.
    </p>
    <div style="background:linear-gradient(135deg,#1e1b4b,#312e81,#0c4a6e);border-radius:16px;padding:28px;color:white;text-align:center;">
      <p style="font-size:14px;opacity:0.85;margin:0 0 16px;">Review reference</p>
      <p style="font-size:18px;font-weight:600;margin:0 0 20px;letter-spacing:0.5px;">${escapeHtml(id)}</p>
      <a href="${escapeHtml(videoUrl)}" style="display:inline-block;background:#7c5cff;color:white;padding:12px 32px;border-radius:9999px;text-decoration:none;font-weight:600;">Watch your review</a>
    </div>
    <p style="font-size:13px;color:#64748b;text-align:center;margin:20px 0 0;">
      We appreciate your time and feedback.
    </p>
  </div>
</body></html>`;

  const text = [
    `Thanks, ${name}!`,
    "",
    "Your video review has been recorded. You can replay it any time:",
    videoUrl,
    "",
    `Reference: ${id}`,
  ].join("\n");

  try {
    const region = process.env.AWS_REGION ?? "us-east-1";
    const ses = new SESClient({ region });
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      }),
    );
    // Best-effort persistence so the admin dashboard can list this review.
    // We do this *after* SES so a DB outage doesn't cost the customer their
    // email; we log on failure but don't surface it.
    if (isReviewsDbConfigured()) {
      try {
        await saveReview({
          id,
          name: rawName,
          title: title || null,
          email,
          videoUrl,
          videoMimeType,
        });
      } catch (err) {
        console.warn("[reviews] DB save failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { isAuthenticated } from "@/lib/admin-auth";
import {
  getSession,
  getTemplate,
  isDbConfigured,
  isTemplatesDbConfigured,
  listSessions,
} from "@/lib/db";
import {
  PLACEHOLDER_VALUES,
  mergeTags,
  renderTemplate,
} from "@/lib/marketing";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  /** "test" sends one rendered email to `testEmail` using either
   *  `contactId`'s session for merge values (if set) or placeholders.
   *  "all" iterates every session that has a valid email and sends one
   *  per contact, rendering with each contact's own values. */
  mode?: "test" | "all";
  testEmail?: string;
  contactId?: string;
};

const SEND_RATE_PER_SECOND = 12; // SES production default is 14/sec — leave headroom

export async function POST(req: Request, { params }: Props) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTemplatesDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_TEMPLATES_TABLE is not configured." },
      { status: 503 },
    );
  }
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    return NextResponse.json(
      { error: "SES_FROM_EMAIL is not configured." },
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

  const template = await getTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  ).replace(/\/$/, "");
  const region = process.env.AWS_REGION ?? "us-east-1";
  const ses = new SESClient({ region });

  const sendOne = async (to: string, subject: string, html: string) => {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      }),
    );
  };

  // Mode: test — single recipient.
  if (body.mode === "test") {
    const to = (body.testEmail ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { error: "Enter a valid test email address." },
        { status: 400 },
      );
    }
    // Merge from the contact's session if given, otherwise placeholders.
    let subject: string;
    let html: string;
    if (body.contactId && isDbConfigured()) {
      const session = await getSession(body.contactId);
      if (session) {
        const rendered = renderTemplate(template, session, { origin });
        subject = rendered.subject;
        html = rendered.html;
      } else {
        subject = mergeTags(template.subject, PLACEHOLDER_VALUES);
        html = mergeTags(template.htmlBody, PLACEHOLDER_VALUES);
      }
    } else {
      subject = mergeTags(template.subject, PLACEHOLDER_VALUES);
      html = mergeTags(template.htmlBody, PLACEHOLDER_VALUES);
    }
    try {
      await sendOne(to, subject, html);
      return NextResponse.json({ ok: true, sent: 1, failed: 0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed.";
      console.error("[marketing] test send failed:", err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Mode: all — iterate sessions with valid emails, send per-recipient.
  if (body.mode === "all") {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: "DYNAMODB_TABLE not configured — can't list contacts." },
        { status: 503 },
      );
    }
    const sessions = await listSessions();
    const targets = sessions.filter((s) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.details.email ?? ""),
    );

    let sent = 0;
    let failed = 0;
    const failures: { contactId: string; email: string; error: string }[] = [];

    for (const session of targets) {
      const { subject, html } = renderTemplate(template, session, { origin });
      try {
        await sendOne(session.details.email, subject, html);
        sent++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        failures.push({
          contactId: session.id,
          email: session.details.email,
          error: message,
        });
        console.warn(
          `[marketing] send failed → ${session.details.email}:`,
          message,
        );
      }
      // Throttle to stay under SES rate limit. ~80ms between sends ⇒
      // ~12/sec, well below the 14/sec production cap.
      await new Promise((r) => setTimeout(r, 1000 / SEND_RATE_PER_SECOND));
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      totalEligible: targets.length,
      totalContacts: sessions.length,
      failures: failures.slice(0, 20),
    });
  }

  return NextResponse.json(
    { error: "Body must include `mode: 'test' | 'all'`." },
    { status: 400 },
  );
}

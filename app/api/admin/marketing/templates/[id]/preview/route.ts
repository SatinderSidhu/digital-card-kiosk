import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getSession, getTemplate, isDbConfigured } from "@/lib/db";
import {
  PLACEHOLDER_VALUES,
  mergeTags,
  renderTemplate,
} from "@/lib/marketing";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = {
  /** Optional: render with this session's data. If omitted (or the row
   *  doesn't exist), placeholder values are used. */
  contactId?: string;
  /** Optional: preview *unsaved* edits without persisting them. When
   *  supplied, the merge uses these strings instead of the stored
   *  template fields. */
  draft?: { subject?: string; htmlBody?: string };
};

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
    // empty body is allowed — preview with the stored template + placeholders.
  }

  const template = await getTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  // Apply unsaved draft edits, if any.
  const effective = {
    ...template,
    subject:
      typeof body.draft?.subject === "string" ? body.draft.subject : template.subject,
    htmlBody:
      typeof body.draft?.htmlBody === "string" ? body.draft.htmlBody : template.htmlBody,
  };

  // Resolve the merge context.
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  ).replace(/\/$/, "");

  if (body.contactId && isDbConfigured()) {
    const session = await getSession(body.contactId);
    if (session) {
      const { subject, html, values } = renderTemplate(effective, session, {
        origin,
      });
      return NextResponse.json({
        subject,
        html,
        values,
        contactId: session.id,
        contactName: session.details.fullName,
      });
    }
  }

  // Fall back to placeholders.
  return NextResponse.json({
    subject: mergeTags(effective.subject, PLACEHOLDER_VALUES),
    html: mergeTags(effective.htmlBody, PLACEHOLDER_VALUES),
    values: PLACEHOLDER_VALUES,
    contactId: null,
    contactName: null,
  });
}

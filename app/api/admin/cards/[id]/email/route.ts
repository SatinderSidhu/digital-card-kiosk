import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getSession, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = { email?: string };

/**
 * Admin-triggered resend. Delegates to the existing public email endpoint
 * so the SES rendering and headers stay in one place. The admin can
 * optionally override the destination address; default is the address on
 * the card itself.
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
    // empty body is allowed — we'll fall back to the email on the card.
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

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/sessions/${id}/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: target }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(data, { status: res.status });
}

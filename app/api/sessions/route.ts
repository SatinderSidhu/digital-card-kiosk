import { NextResponse } from "next/server";
import { isDbConfigured, saveSession } from "@/lib/db";
import type { CardDetails, TemplateId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type CreateSessionBody = {
  sessionId?: string;
  details?: CardDetails;
  template?: TemplateId;
  photoDataUrl?: string | null;
};

const VALID_TEMPLATES: TemplateId[] = [
  "aurora",
  "mono",
  "sunset",
  "neon",
  "forest",
  "noir",
];

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        error:
          "DYNAMODB_TABLE is not configured on the server. Set it in your Amplify (or local .env) environment variables.",
      },
      { status: 503 },
    );
  }

  let body: CreateSessionBody;
  try {
    body = (await req.json()) as CreateSessionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json(
      { error: "Missing sessionId." },
      { status: 400 },
    );
  }
  if (!body.template || !VALID_TEMPLATES.includes(body.template)) {
    return NextResponse.json(
      { error: "Missing or invalid template." },
      { status: 400 },
    );
  }
  if (!body.details || typeof body.details !== "object") {
    return NextResponse.json(
      { error: "Missing details." },
      { status: 400 },
    );
  }

  try {
    await saveSession({
      id: body.sessionId,
      details: body.details,
      template: body.template,
      photoDataUrl: body.photoDataUrl ?? null,
    });

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
    return NextResponse.json({
      url: `${origin.replace(/\/$/, "")}/c/${body.sessionId}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save session.";
    // Surface DynamoDB's "ValidationException: ... > 400KB" or auth errors as-is.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

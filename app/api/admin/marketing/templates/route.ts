import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAuthenticated } from "@/lib/admin-auth";
import {
  isTemplatesDbConfigured,
  listTemplates,
  saveTemplate,
} from "@/lib/db";
import { STARTER_TEMPLATE } from "@/lib/marketing";

export const runtime = "nodejs";
export const maxDuration = 30;

type CreateBody = {
  name?: string;
  subject?: string;
  htmlBody?: string;
  /** When true, ignore name/subject/htmlBody and seed from the starter
   *  template (lib/marketing.ts → STARTER_TEMPLATE). */
  fromStarter?: boolean;
};

function newTemplateId(): string {
  return randomBytes(6).toString("base64url");
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTemplatesDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_TEMPLATES_TABLE is not configured." },
      { status: 503 },
    );
  }
  try {
    const items = await listTemplates();
    return NextResponse.json({ count: items.length, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not list.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTemplatesDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_TEMPLATES_TABLE is not configured." },
      { status: 503 },
    );
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const id = newTemplateId();
  const record = body.fromStarter
    ? { id, ...STARTER_TEMPLATE, createdAt: now, updatedAt: now }
    : {
        id,
        name: (body.name ?? "Untitled template").trim() || "Untitled template",
        subject: (body.subject ?? "").trim(),
        htmlBody: body.htmlBody ?? "",
        createdAt: now,
        updatedAt: now,
      };

  try {
    const saved = await saveTemplate(record);
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

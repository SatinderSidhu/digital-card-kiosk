import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import {
  deleteTemplate,
  getTemplate,
  isDbConfigured,
  saveTemplate,
} from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type UpdateBody = {
  name?: string;
  subject?: string;
  htmlBody?: string;
};

export async function GET(_req: Request, { params }: Props) {
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
  try {
    const t = await getTemplate(id);
    if (!t) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(t);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(req: Request, { params }: Props) {
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
  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const existing = await getTemplate(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const saved = await saveTemplate({
      ...existing,
      name: typeof body.name === "string" ? body.name : existing.name,
      subject:
        typeof body.subject === "string" ? body.subject : existing.subject,
      htmlBody:
        typeof body.htmlBody === "string" ? body.htmlBody : existing.htmlBody,
    });
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(_req: Request, { params }: Props) {
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
  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

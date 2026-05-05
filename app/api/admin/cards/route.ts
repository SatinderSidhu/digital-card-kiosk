import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { isDbConfigured, listSessions } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_TABLE is not configured." },
      { status: 503 },
    );
  }

  try {
    const sessions = await listSessions();
    // Trim photo data URLs out of the list payload — they can be megabytes
    // each; the detail endpoint includes them.
    const items = sessions.map((s) => ({
      id: s.id,
      fullName: s.details.fullName,
      title: s.details.title,
      company: s.details.company,
      email: s.details.email,
      template: s.template,
      hasPhoto: !!s.photoDataUrl,
      createdAt: s.createdAt,
    }));
    return NextResponse.json({ count: items.length, items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not list sessions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

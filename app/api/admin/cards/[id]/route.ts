import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getSession, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };

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
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not fetch session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

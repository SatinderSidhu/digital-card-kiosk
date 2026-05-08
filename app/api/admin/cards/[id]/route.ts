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
    // Inline the photo as a data URL when it's an https URL (post-S3-upload
    // photos). Lets the admin client render the card AND capture it via
    // html2canvas without requiring CORS on the photo bucket — the data URL
    // is same-origin from the browser's perspective.
    const inlined = await inlinePhoto(session.photoDataUrl);
    return NextResponse.json({ ...session, photoDataUrl: inlined });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not fetch session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function inlinePhoto(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith("http")) return value; // already a data URL
  try {
    const res = await fetch(value);
    if (!res.ok) return value;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn("[admin-cards] photo inline failed:", err);
    return value;
  }
}

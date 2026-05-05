import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getReview, isReviewsDbConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Props = { params: Promise<{ id: string }> };
type Body = { email?: string };

export async function POST(req: Request, { params }: Props) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isReviewsDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_REVIEWS_TABLE is not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // empty body is fine.
  }

  const review = await getReview(id);
  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  const target = body.email?.trim() || review.email;
  if (!target) {
    return NextResponse.json(
      { error: "No email on file and none provided." },
      { status: 400 },
    );
  }

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/reviews/${id}/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: target,
      name: review.name,
      title: review.title,
      videoUrl: review.videoUrl,
      videoMimeType: review.videoMimeType,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(data, { status: res.status });
}

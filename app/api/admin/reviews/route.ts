import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { isReviewsDbConfigured, listReviews } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isReviewsDbConfigured()) {
    return NextResponse.json(
      { error: "DYNAMODB_REVIEWS_TABLE is not configured." },
      { status: 503 },
    );
  }

  try {
    const reviews = await listReviews();
    return NextResponse.json({ count: reviews.length, items: reviews });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not list reviews.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

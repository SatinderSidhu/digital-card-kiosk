import { NextResponse } from "next/server";
import { isDbConfigured, saveSession } from "@/lib/db";
import { isS3Configured, uploadPhoto } from "@/lib/s3";
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
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }
  if (!body.template || !VALID_TEMPLATES.includes(body.template)) {
    return NextResponse.json(
      { error: "Missing or invalid template." },
      { status: 400 },
    );
  }
  if (!body.details || typeof body.details !== "object") {
    return NextResponse.json({ error: "Missing details." }, { status: 400 });
  }

  // If a photo was captured, upload it to S3 first and store only the URL
  // in DynamoDB. Skipping the photo (Skip-photo button) is fine — we store
  // null and the public page renders the card without a portrait.
  let photoUrl: string | null = null;
  if (body.photoDataUrl) {
    if (!isS3Configured()) {
      return NextResponse.json(
        {
          error:
            "S3_PHOTO_BUCKET is not configured on the server. Set it in your Amplify (or local .env) environment variables.",
        },
        { status: 503 },
      );
    }
    try {
      photoUrl = await uploadPhoto(body.sessionId, body.photoDataUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Photo upload failed.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  try {
    await saveSession({
      id: body.sessionId,
      details: body.details,
      template: body.template,
      // Field name kept as `photoDataUrl` for diff continuity; contents are
      // an https URL pointing at S3 (or null if the user skipped the photo).
      photoDataUrl: photoUrl,
    });

    // Fire-and-forget onboard API call — does not block the response.
    onboardExternalApi(body.details, photoUrl).catch(() => {});

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
    return NextResponse.json({
      url: `${origin.replace(/\/$/, "")}/c/${body.sessionId}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

async function onboardExternalApi(
  details: CardDetails,
  photoUrl: string | null,
): Promise<void> {
  const onboardUrl = "https://mydigitalcard-admin.kitlabs.us/api/onboard";
  const token = "83cjgo$w$hs2mnj&wlwb73x23";

  const [firstName, ...rest] = details.fullName.trim().split(" ");
  const lastName = rest.join(" ");

  const form = new FormData();
  form.append("name", details.fullName);
  form.append("email", details.email);
  form.append("password", generatePassword());
  form.append("first_name", firstName);
  form.append("last_name", lastName);
  form.append("phone_1", details.phone);
  form.append("job_role_title", details.title);
  form.append("company_name", details.company);

  if (photoUrl) {
    const photoRes = await fetch(photoUrl);
    const blob = await photoRes.blob();
    form.append("head_shot", blob, "headshot.jpg");
  }

  await fetch(onboardUrl, {
    method: "POST",
    headers: { "X-Onboard-Token": token },
    body: form,
  });
}

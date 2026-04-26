import type { CardDetails, TemplateId } from "./types";

export type SharePayload = {
  sessionId: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;
};

/**
 * Persists the current kiosk session via /api/sessions (DynamoDB) and
 * returns the public-card URL the QR / future SMS+email links target.
 * This is no longer a mock — it does an actual POST.
 */
export async function mockCreateSession(
  payload: SharePayload,
): Promise<{ url: string }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Server returned ${res.status}`);
  }
  return (await res.json()) as { url: string };
}

/** TODO: replace with real email API call (SES) — coming in next commit. */
export async function mockSendEmail(
  email: string,
  payload: SharePayload,
): Promise<{ ok: true }> {
  await wait(700);
  if (!email.includes("@")) throw new Error("Invalid email");
  console.info("[mock] email dispatched", { email, session: payload.sessionId });
  return { ok: true };
}

/** TODO: replace with real SMS API call (SNS) — coming in next commit. */
export async function mockSendSms(
  phone: string,
  payload: SharePayload,
): Promise<{ ok: true }> {
  await wait(700);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) throw new Error("Enter a valid phone number");
  console.info("[mock] sms dispatched", { phone, session: payload.sessionId });
  return { ok: true };
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

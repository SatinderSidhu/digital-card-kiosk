import type { CardDetails, TemplateId } from "./types";

export type SharePayload = {
  sessionId: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;
};

/** TODO: replace with real POST to backend once API is ready. */
export async function mockCreateSession(payload: SharePayload): Promise<{ url: string }> {
  await wait(400);
  // In real backend this would return a signed short URL hosted by the service.
  const origin = typeof window !== "undefined" ? window.location.origin : "https://card.example";
  return { url: `${origin}/c/${payload.sessionId}` };
}

/** TODO: replace with real email API call. */
export async function mockSendEmail(email: string, payload: SharePayload): Promise<{ ok: true }> {
  await wait(700);
  if (!email.includes("@")) throw new Error("Invalid email");
  console.info("[mock] email dispatched", { email, session: payload.sessionId });
  return { ok: true };
}

/** TODO: replace with real SMS API call (Twilio / MessageBird / etc.). */
export async function mockSendSms(phone: string, payload: SharePayload): Promise<{ ok: true }> {
  await wait(700);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) throw new Error("Enter a valid phone number");
  console.info("[mock] sms dispatched", { phone, session: payload.sessionId });
  return { ok: true };
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

import type { CardDetails, TemplateId } from "./types";

export type SharePayload = {
  sessionId: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;
};

/* The "mock" prefix is historical — these now all hit real route handlers
 * backed by DynamoDB, SES, and SNS. Kept for diff continuity; can be
 * renamed to api-client.ts in a follow-up. */

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Server returned ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Persists the session to DynamoDB and returns the public share URL. */
export async function mockCreateSession(
  payload: SharePayload,
): Promise<{ url: string }> {
  return postJSON<{ url: string }>("/api/sessions", payload);
}

/** Sends the card link + vCard attachment to the given email via AWS SES. */
export async function mockSendEmail(
  email: string,
  payload: SharePayload,
): Promise<{ ok: true }> {
  return postJSON<{ ok: true }>(`/api/sessions/${payload.sessionId}/email`, {
    email,
  });
}

/** Sends the card link to the given phone via AWS SNS as a transactional SMS. */
export async function mockSendSms(
  phone: string,
  payload: SharePayload,
): Promise<{ ok: true }> {
  return postJSON<{ ok: true }>(`/api/sessions/${payload.sessionId}/sms`, {
    phone,
  });
}

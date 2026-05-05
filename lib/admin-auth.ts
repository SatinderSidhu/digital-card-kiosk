import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "admin_session";
const COOKIE_TTL_SEC = 60 * 60 * 12; // 12 hours

/**
 * Lightweight HMAC-cookie auth scheme:
 *   token = base64( HMAC-SHA256( ADMIN_PASSWORD, "admin-session" ) )
 *
 * The token never carries the password — it's just a fixed value that only
 * the server can produce, so we can verify a presented cookie matches.
 * Good enough for a kiosk demo. Swap in NextAuth / iron-session when the
 * threat model gets serious.
 */

function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update("admin-session").digest("base64");
}

export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

export function verifyPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(input);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false;
  const store = await cookies();
  const presented = store.get(COOKIE_NAME)?.value;
  if (!presented) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function setAuthCookie(): Promise<void> {
  const token = expectedToken();
  if (!token) throw new Error("ADMIN_PASSWORD not configured");
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_SEC,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

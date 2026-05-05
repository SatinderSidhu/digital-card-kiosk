import { NextResponse } from "next/server";
import {
  isAdminConfigured,
  setAuthCookie,
  verifyPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

type Body = { password?: string };

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured on the server." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await setAuthCookie();
  return NextResponse.json({ ok: true });
}

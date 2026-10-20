import { NextRequest, NextResponse } from "next/server";
import { adminPassword, isAdminRequest, setAdminCookie } from "@/lib/auth";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return NextResponse.json({ ok: isAdminRequest(request) });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const password =
    typeof (payload as { password?: unknown }).password === "string"
      ? (payload as { password: string }).password
      : "";

  if (password !== adminPassword()) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, true);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, false);
  return response;
}

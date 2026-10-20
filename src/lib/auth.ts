import { NextRequest, NextResponse } from "next/server";

export const PARTICIPANT_COOKIE = "qa_participant";
export const ADMIN_COOKIE = "qa_admin";

const ADMIN_TOKEN = "ok";

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || "sanral";
}

export function isAdminRequest(request: NextRequest) {
  return request.cookies.get(ADMIN_COOKIE)?.value === ADMIN_TOKEN;
}

export function participantIdFrom(request: NextRequest) {
  return request.cookies.get(PARTICIPANT_COOKIE)?.value ?? "";
}

export function setParticipantCookie(response: NextResponse, participantId: string) {
  response.cookies.set(PARTICIPANT_COOKIE, participantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function setAdminCookie(response: NextResponse, on: boolean) {
  if (on) {
    response.cookies.set(ADMIN_COOKIE, ADMIN_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return;
  }
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

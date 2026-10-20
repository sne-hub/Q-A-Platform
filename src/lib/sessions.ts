import { cookies } from "next/headers";

const COOKIE = "participant_id";

export async function getParticipantId() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function setParticipantId(id: string) {
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearParticipantId() {
  (await cookies()).delete(COOKIE);
}
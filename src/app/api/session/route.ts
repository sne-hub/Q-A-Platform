import { NextRequest, NextResponse } from "next/server";
import { participantIdFrom, setParticipantCookie } from "@/lib/auth";
import { questionsForViewer } from "@/lib/group";
import {
  countForEmail,
  deleteParticipantAndQuestions,
  getParticipant,
  listQuestions,
  updateParticipantProfile,
  upsertParticipant,
} from "@/lib/store";
import { MAX_QUESTIONS_PER_PERSON } from "@/lib/types";
import { readProfile } from "@/lib/validate";


export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json({
      participant: null,
      questions: [],
      remaining: MAX_QUESTIONS_PER_PERSON,
    });
  }
  const participant = await getParticipant(participantId);
  const email = participant?.email ?? "";
  const asked = await countForEmail(email);
  const questions = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email,
  });
  return NextResponse.json({
    participant,
    questions,
    remaining: Math.max(0, MAX_QUESTIONS_PER_PERSON - asked),
  });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const profile = readProfile(payload as Record<string, unknown>);
  if (typeof profile === "string") {
    return NextResponse.json({ error: profile }, { status: 400 });
  }

  const participantId = participantIdFrom(request) || crypto.randomUUID();
  const participant = await upsertParticipant(participantId, profile);
  const asked = await countForEmail(participant.email);
  const questions = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email: participant.email,
  });

  const response = NextResponse.json({
    participant,
    questions,
    remaining: Math.max(0, MAX_QUESTIONS_PER_PERSON - asked),
  });
  setParticipantCookie(response, participant.participantId);
  return response;
}

export async function PATCH(request: NextRequest) {
  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json(
      { error: "You must be signed in to update your details." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const profile = readProfile(payload as Record<string, unknown>);
  if (typeof profile === "string") {
    return NextResponse.json({ error: profile }, { status: 400 });
  }

  const result = await updateParticipantProfile(participantId, profile);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { participant } = result;
  const asked = await countForEmail(participant.email);
  const questions = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email: participant.email,
  });

  return NextResponse.json({
    participant,
    questions,
    remaining: Math.max(0, MAX_QUESTIONS_PER_PERSON - asked),
  });
}

export async function DELETE(request: NextRequest) {
  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json(
      { error: "You must be signed in to delete your details." },
      { status: 401 },
    );
  }

  await deleteParticipantAndQuestions(participantId);

  // Clear the participant cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.set("qa_participant", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import { participantIdFrom } from "@/lib/auth";
import { questionsForViewer } from "@/lib/group";
import { finishParticipant, getParticipant, listQuestions, reopenParticipant } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json({ error: "No active session." }, { status: 401 });
  }
  const participant = await finishParticipant(participantId);
  if (!participant) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  const current = (await getParticipant(participantId)) ?? participant;
  const questions = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email: current.email,
  });
  return NextResponse.json({ participant: current, questions });
}

export async function DELETE(request: NextRequest) {
  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json({ error: "No active session." }, { status: 401 });
  }

  const participant = await getParticipant(participantId);
  if (!participant) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // Can only reopen if they haven't used all their questions yet.
  const questions = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email: participant.email,
  });
  if (questions.length >= 3) {
    return NextResponse.json(
      { error: "You have already used all of your questions." },
      { status: 409 },
    );
  }

  const reopened = await reopenParticipant(participantId);
  if (!reopened) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ participant: reopened, questions });
}

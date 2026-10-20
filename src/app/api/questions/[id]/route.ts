import { NextRequest, NextResponse } from "next/server";
import { participantIdFrom } from "@/lib/auth";
import { questionsForViewer } from "@/lib/group";
import { deleteQuestion, getParticipant, listQuestions, updateQuestionBody } from "@/lib/store";
import { clean } from "@/lib/validate";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json(
      { error: "You must be signed in to edit a question." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = clean((payload as Record<string, unknown>).body);
  if (!body || body.length > 600) {
    return NextResponse.json(
      { error: "Please enter a question of up to 600 characters." },
      { status: 400 },
    );
  }

  const updated = await updateQuestionBody(id, participantId, body);
  if (!updated) {
    return NextResponse.json(
      { error: "Question not found or you don't have permission to edit it." },
      { status: 404 },
    );
  }

  const participant = await getParticipant(participantId);
  const questions = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email: participant?.email ?? "",
  });

  return NextResponse.json({ question: updated, questions });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json(
      { error: "You must be signed in to delete a question." },
      { status: 401 },
    );
  }

  const deleted = await deleteQuestion(id, participantId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Question not found or you don't have permission to delete it." },
      { status: 404 },
    );
  }

  const participant = await getParticipant(participantId);
  const questions = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email: participant?.email ?? "",
  });

  return NextResponse.json({ ok: true, questions, participant });
}

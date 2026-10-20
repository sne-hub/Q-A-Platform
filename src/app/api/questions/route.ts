import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, participantIdFrom } from "@/lib/auth";
import { questionsForViewer } from "@/lib/group";
import {
  addQuestion,
  countForEmail,
  getParticipant,
  listQuestions,
} from "@/lib/store";
import { MAX_QUESTIONS_PER_PERSON, type Question } from "@/lib/types";
import { clean } from "@/lib/validate";

export const runtime = "nodejs";

async function viewerEmail(request: NextRequest) {
  const fromQuery = clean(request.nextUrl.searchParams.get("email") ?? "").toLowerCase();
  if (fromQuery) return fromQuery;
  const participant = await getParticipant(participantIdFrom(request));
  return participant?.email ?? "";
}

export async function GET(request: NextRequest) {
  const all = await listQuestions();
  const questions = questionsForViewer(all, {
    isAdmin: isAdminRequest(request),
    email: await viewerEmail(request),
  });
  return NextResponse.json({ questions });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const participantId = participantIdFrom(request);
  if (!participantId) {
    return NextResponse.json(
      { error: "Please submit your details before asking a question." },
      { status: 401 },
    );
  }

  const participant = await getParticipant(participantId);
  if (!participant) {
    return NextResponse.json(
      { error: "Your session was not found. Please enter your details again." },
      { status: 401 },
    );
  }
  if (participant.finished) {
    return NextResponse.json(
      { error: "You have already ended your questions." },
      { status: 409 },
    );
  }

  const questionBody = clean((payload as Record<string, unknown>).body);
  if (!questionBody || questionBody.length > 600) {
    return NextResponse.json(
      { error: "Please enter a question of up to 600 characters." },
      { status: 400 },
    );
  }

  const used = await countForEmail(participant.email);
  if (used >= MAX_QUESTIONS_PER_PERSON) {
    return NextResponse.json(
      { error: `You can ask up to ${MAX_QUESTIONS_PER_PERSON} questions.` },
      { status: 429 },
    );
  }

  const question: Question = {
    id: crypto.randomUUID(),
    participantId: participant.participantId,
    firstName: participant.firstName,
    lastName: participant.lastName,
    email: participant.email,
    phone: participant.phone,
    company: participant.company,
    designation: participant.designation,
    body: questionBody,
    createdAt: new Date().toISOString(),
  };

  await addQuestion(question);
  const remaining = MAX_QUESTIONS_PER_PERSON - used - 1;
  const mine = questionsForViewer(await listQuestions(), {
    isAdmin: false,
    email: participant.email,
  });

  return NextResponse.json(
    { question, remaining, questions: mine },
    { status: 201 },
  );
}

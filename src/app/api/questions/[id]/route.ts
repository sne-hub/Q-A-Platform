import { NextRequest, NextResponse } from "next/server";
import { participantIdFrom } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadQuestions, loadSession } from "@/lib/data";
import { rowToQuestion } from "@/lib/mappers";
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

  const { data, error } = await supabaseAdmin
    .from("questions")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("participant_id", participantId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Question not found or you don't have permission to edit it." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    question: rowToQuestion(data),
    questions: await loadQuestions(participantId),
  });
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

  const { data, error } = await supabaseAdmin
    .from("questions")
    .delete()
    .eq("id", id)
    .eq("participant_id", participantId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { error: "Question not found or you don't have permission to delete it." },
      { status: 404 },
    );
  }

  const session = await loadSession(participantId);
  return NextResponse.json({
    ok: true,
    questions: session?.questions ?? [],
    participant: session?.participant ?? null,
  });
}
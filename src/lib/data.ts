import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToParticipant, rowToQuestion } from "@/lib/mappers";

export async function loadQuestions(participantId: string) {
  const { data } = await supabaseAdmin
    .from("questions")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(rowToQuestion);
}

export async function loadSession(participantId: string) {
  const { data } = await supabaseAdmin
    .from("participants")
    .select("*")
    .eq("id", participantId)
    .maybeSingle();
  if (!data) return null;
  return {
    participant: rowToParticipant(data),
    questions: await loadQuestions(participantId),
  };
}
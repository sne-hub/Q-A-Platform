import { supabaseAdmin as db } from "@/lib/supabase/server";
import { MAX_QUESTIONS_PER_PERSON, type Participant, type Profile, type Question } from "./types";

/* ---------- row <-> object mapping ---------- */

type Row = Record<string, any>;

const profileRow = (p: Profile) => ({
  first_name: p.firstName,
  last_name: p.lastName,
  email: p.email,
  phone: p.phone,
  company: p.company,
  designation: p.designation,
});

const toParticipant = (r: Row): Participant => ({
  participantId: r.id,
  firstName: r.first_name ?? "",
  lastName: r.last_name ?? "",
  email: r.email ?? "",
  phone: r.phone ?? "",
  company: r.company ?? "",
  designation: r.designation ?? "",
  finished: r.finished,
  editedAt: r.edited_at ?? null,
});

const toQuestion = (r: Row): Question => ({
  id: r.id,
  participantId: r.participant_id,
  firstName: r.first_name ?? "",
  lastName: r.last_name ?? "",
  email: r.email ?? "",
  phone: r.phone ?? "",
  company: r.company ?? "",
  designation: r.designation ?? "",
  body: r.body,
  createdAt: r.created_at,
  editedAt: r.edited_at ?? null,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/* ---------- live-update listeners (in-memory, used by the stream route) ---------- */

const globalStore = globalThis as typeof globalThis & {
  __qaListeners?: Set<(questions: Question[]) => void>;
};

export function getListeners(): Set<(questions: Question[]) => void> {
  if (!globalStore.__qaListeners) globalStore.__qaListeners = new Set();
  return globalStore.__qaListeners;
}

async function notify() {
  const listeners = getListeners();
  if (listeners.size === 0) return;
  const questions = await listQuestions();
  for (const listener of listeners) listener(questions);
}

/* ---------- questions ---------- */

export async function listQuestions(): Promise<Question[]> {
  const data = check(
    await db.from("questions").select("*").order("created_at", { ascending: false }),
  );
  return (data ?? []).map(toQuestion);
}

export async function countForEmail(email: string): Promise<number> {
  const needle = email.trim().toLowerCase();
  if (!needle) return 0;
  const { count, error } = await db
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("email", needle);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function addQuestion(question: Question): Promise<Question> {
  const { data, error } = await db
    .from("questions")
    .insert({
      id: question.id,
      participant_id: question.participantId,
      ...profileRow(question),
      body: question.body,
      created_at: question.createdAt,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await notify();
  return toQuestion(data);
}

export async function updateQuestionBody(
  id: string,
  participantId: string,
  body: string,
): Promise<Question | null> {
  const { data: current, error: findError } = await db
    .from("questions")
    .select("*")
    .eq("id", id)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!current) return null;
  if (current.body === body) return toQuestion(current);

  const updated = check(
    await db
      .from("questions")
      .update({ body, edited_at: new Date().toISOString() })
      .eq("id", id)
      .eq("participant_id", participantId)
      .select()
      .single(),
  );
  await notify();
  return toQuestion(updated);
}

export async function deleteQuestion(id: string, participantId: string): Promise<boolean> {
  const { data: target, error: findError } = await db
    .from("questions")
    .select("id")
    .eq("id", id)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!target) return false;

  const { count } = await db
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId);

  check(
    await db.from("questions").delete().eq("id", id).eq("participant_id", participantId),
  );

  // They had hit the cap, so deleting frees a slot: reopen asking.
  if ((count ?? 0) >= MAX_QUESTIONS_PER_PERSON) {
    check(
      await db
        .from("participants")
        .update({ finished: false })
        .eq("id", participantId)
        .eq("finished", true),
    );
  }

  await notify();
  return true;
}

/* ---------- participants ---------- */

export async function getParticipant(participantId: string) {
  if (!participantId) return null;
  const { data, error } = await db
    .from("participants")
    .select("*")
    .eq("id", participantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toParticipant(data) : null;
}

export async function getParticipantByEmail(email: string) {
  const { data, error } = await db
    .from("participants")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toParticipant(data) : null;
}

export async function upsertParticipant(
  participantId: string,
  profile: Profile,
): Promise<Participant> {
  const email = profile.email.trim().toLowerCase();
  const row = profileRow({ ...profile, email });

  // Same email already registered: reuse that participant (matches your old behaviour)
  const { data: byEmail, error: e1 } = await db
    .from("participants")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (byEmail) {
    const updated = check(
      await db.from("participants").update(row).eq("id", byEmail.id).select().single(),
    );
    return toParticipant(updated);
  }

  // Same cookie id already registered: update its details
  const { data: byId, error: e2 } = await db
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (byId) {
    const updated = check(
      await db.from("participants").update(row).eq("id", participantId).select().single(),
    );
    return toParticipant(updated);
  }

  const created = check(
    await db.from("participants").insert({ id: participantId, ...row }).select().single(),
  );
  return toParticipant(created);
}

export async function finishParticipant(participantId: string) {
  const { data, error } = await db
    .from("participants")
    .update({ finished: true })
    .eq("id", participantId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toParticipant(data) : null;
}

export async function reopenParticipant(participantId: string) {
  const { data, error } = await db
    .from("participants")
    .update({ finished: false })
    .eq("id", participantId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toParticipant(data) : null;
}

export async function updateParticipantProfile(
  participantId: string,
  profile: Profile,
): Promise<{ participant: Participant } | { error: string; status: number }> {
  const current = await getParticipant(participantId);
  if (!current) return { error: "We couldn’t find your details.", status: 404 };

  const email = profile.email.trim().toLowerCase();
  const next: Profile = { ...profile, email };

  const { data: taken, error: takenError } = await db
    .from("participants")
    .select("id")
    .eq("email", email)
    .neq("id", participantId)
    .maybeSingle();
  if (takenError) throw new Error(takenError.message);
  if (taken) {
    return { error: "That email address is already used by someone else.", status: 409 };
  }

  const keys: (keyof Profile)[] = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "company",
    "designation",
  ];
  if (!keys.some((key) => current[key] !== next[key])) return { participant: current };

  const { data, error } = await db
    .from("participants")
    .update({ ...profileRow(next), edited_at: new Date().toISOString() })
    .eq("id", participantId)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return { error: "That email address is already used by someone else.", status: 409 };
    }
    throw new Error(error.message);
  }

  // Questions carry a copy of the profile; keep them in sync (their edited_at is untouched)
  check(await db.from("questions").update(profileRow(next)).eq("participant_id", participantId));

  await notify();
  return { participant: toParticipant(data) };
}

export async function deleteParticipantAndQuestions(participantId: string): Promise<void> {
  // questions are removed by "on delete cascade"
  check(await db.from("participants").delete().eq("id", participantId));
  await notify();
}
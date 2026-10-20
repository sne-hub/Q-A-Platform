import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_QUESTIONS_PER_PERSON, type Participant, type Profile, type Question } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "questions.json");

type StoreShape = {
  questions: Question[];
  participants: Participant[];
};

const globalStore = globalThis as typeof globalThis & {
  __qaStore?: StoreShape;
  __qaWriteQueue?: Promise<void>;
  __qaListeners?: Set<(questions: Question[]) => void>;
};

function getMemory(): StoreShape {
  if (!globalStore.__qaStore) {
    globalStore.__qaStore = { questions: [], participants: [] };
  }
  return globalStore.__qaStore;
}

export function getListeners(): Set<(questions: Question[]) => void> {
  if (!globalStore.__qaListeners) {
    globalStore.__qaListeners = new Set();
  }
  return globalStore.__qaListeners;
}

async function persist(store: StoreShape) {
  globalStore.__qaWriteQueue = (globalStore.__qaWriteQueue ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
    });
  await globalStore.__qaWriteQueue;
}

function notify() {
  const questions = [...getMemory().questions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const listener of getListeners()) {
    listener(questions);
  }
}

let loaded = false;

function asQuestion(value: Question): Question {
  return {
    id: value.id,
    participantId: value.participantId,
    firstName: value.firstName ?? "",
    lastName: value.lastName ?? "",
    email: value.email ?? "",
    phone: value.phone ?? "",
    company: value.company ?? "",
    designation: value.designation ?? "",
    body: value.body,
    createdAt: value.createdAt,
    editedAt: value.editedAt ?? null,
  };
}

export async function loadStore(): Promise<StoreShape> {
  const memory = getMemory();
  if (loaded) return memory;
  loaded = true;
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    if (Array.isArray(parsed.questions)) {
      memory.questions = parsed.questions.map(asQuestion);
    }
    if (Array.isArray(parsed.participants)) {
      memory.participants = parsed.participants;
    }
  } catch {
    // First run or empty file — start with an empty list.
  }
  return memory;
}

export async function listQuestions(): Promise<Question[]> {
  const store = await loadStore();
  return [...store.questions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getParticipant(participantId: string) {
  const store = await loadStore();
  return store.participants.find((item) => item.participantId === participantId) ?? null;
}

export async function getParticipantByEmail(email: string) {
  const store = await loadStore();
  const needle = email.trim().toLowerCase();
  return (
    store.participants.find((item) => item.email.trim().toLowerCase() === needle) ?? null
  );
}

export async function upsertParticipant(
  participantId: string,
  profile: Profile,
): Promise<Participant> {
  const store = await loadStore();
  const email = profile.email.trim().toLowerCase();
  const byEmail = store.participants.find(
    (item) => item.email.trim().toLowerCase() === email,
  );
  if (byEmail) {
    Object.assign(byEmail, profile, { email });
    await persist(store);
    return byEmail;
  }
  const existing = store.participants.find((item) => item.participantId === participantId);
  if (existing) {
    Object.assign(existing, profile, { email });
    await persist(store);
    return existing;
  }
  const created: Participant = {
    participantId,
    finished: false,
    ...profile,
    email,
  };
  store.participants.push(created);
  await persist(store);
  return created;
}

export async function finishParticipant(participantId: string) {
  const store = await loadStore();
  const existing = store.participants.find((item) => item.participantId === participantId);
  if (!existing) return null;
  existing.finished = true;
  await persist(store);
  return existing;
}

export async function reopenParticipant(participantId: string) {
  const store = await loadStore();
  const existing = store.participants.find((item) => item.participantId === participantId);
  if (!existing) return null;
  existing.finished = false;
  await persist(store);
  return existing;
}

export async function countForEmail(email: string): Promise<number> {
  const store = await loadStore();
  const needle = email.trim().toLowerCase();
  return store.questions.filter((q) => q.email.trim().toLowerCase() === needle).length;
}

export async function addQuestion(question: Question): Promise<Question> {
  const store = await loadStore();
  store.questions.push(question);
  await persist(store);
  notify();
  return question;
}
/*
 * STEP 1 — edit the top of src/lib/store.ts:
 *
 *   a) Import the constant as a value (it's currently `import type`):
 *        import { MAX_QUESTIONS_PER_PERSON } from "./types";
 *        import type { Participant, Profile, Question } from "./types";
 *
 *   b) In asQuestion(), add one line so editedAt survives a reload:
 *        createdAt: value.createdAt,
 *        editedAt: value.editedAt ?? null,
 *
 * STEP 2 — paste everything below at the bottom of src/lib/store.ts.
 * (persist() and notify() are already defined in that file.)
 */

function ownsQuestion(question: Question, participantId: string, email?: string) {
  if (question.participantId === participantId) return true;
  return (
    !!email && question.email.trim().toLowerCase() === email.trim().toLowerCase()
  );
}

export async function updateQuestionBody(
  id: string,
  participantId: string,
  body: string,
): Promise<Question | null> {
  const store = await loadStore();
  const participant = store.participants.find((p) => p.participantId === participantId);
  const question = store.questions.find(
    (q) => q.id === id && ownsQuestion(q, participantId, participant?.email),
  );
  if (!question) return null;
  if (question.body !== body) {
    question.body = body;
    question.editedAt = new Date().toISOString();
    await persist(store);
    notify();
  }
  return question;
}

export async function deleteQuestion(id: string, participantId: string): Promise<boolean> {
  const store = await loadStore();
  const participant = store.participants.find((p) => p.participantId === participantId);
  const target = store.questions.find(
    (q) => q.id === id && ownsQuestion(q, participantId, participant?.email),
  );
  if (!target) return false;

  const ownedBefore = store.questions.filter((q) =>
    ownsQuestion(q, participantId, participant?.email),
  ).length;

  store.questions = store.questions.filter((q) => q.id !== id);

  // They had hit the cap, so deleting frees a slot: reopen asking.
  if (participant?.finished && ownedBefore >= MAX_QUESTIONS_PER_PERSON) {
    participant.finished = false;
  }

  await persist(store);
  notify();
  return true;
}

export async function updateParticipantProfile(
  participantId: string,
  profile: Profile,
): Promise<{ participant: Participant } | { error: string; status: number }> {
  const store = await loadStore();
  const participant = store.participants.find((p) => p.participantId === participantId);
  if (!participant) return { error: "We couldn’t find your details.", status: 404 };

  const email = profile.email.trim().toLowerCase();
  const taken = store.participants.find(
    (p) => p.participantId !== participantId && p.email.trim().toLowerCase() === email,
  );
  if (taken) {
    return { error: "That email address is already used by someone else.", status: 409 };
  }

  const next: Profile = { ...profile, email };
  const keys: (keyof Profile)[] = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "company",
    "designation",
  ];
  const changed = keys.some((key) => participant[key] !== next[key]);
  if (!changed) return { participant };

  const oldEmail = participant.email.trim().toLowerCase();
  Object.assign(participant, next, { editedAt: new Date().toISOString() });

  // Questions carry a copy of the profile, so keep them in sync
  // (their own editedAt is NOT touched — the question text didn't change).
  for (const question of store.questions) {
    if (
      question.participantId === participantId ||
      question.email.trim().toLowerCase() === oldEmail
    ) {
      Object.assign(question, next);
    }
  }

  await persist(store);
  notify();
  return { participant };
}

export async function deleteParticipantAndQuestions(participantId: string): Promise<void> {
  const store = await loadStore();
  const participant = store.participants.find((p) => p.participantId === participantId);
  store.questions = store.questions.filter(
    (q) => !ownsQuestion(q, participantId, participant?.email),
  );
  store.participants = store.participants.filter((p) => p.participantId !== participantId);
  await persist(store);
  notify();
}
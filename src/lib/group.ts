import type { PersonGroup, Question } from "./types";

export function personKey(question: Pick<Question, "firstName" | "lastName" | "email">) {
  return [
    question.firstName.trim().toLowerCase(),
    question.lastName.trim().toLowerCase(),
    question.email.trim().toLowerCase(),
  ].join("|");
}

export function groupQuestions(questions: Question[]): PersonGroup[] {
  const groups = new Map<string, PersonGroup>();
  const chronological = [...questions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const question of chronological) {
    const key = personKey(question);
    const existing = groups.get(key);
    if (existing) {
      existing.questions.push(question);
      continue;
    }
    groups.set(key, {
      key,
      firstName: question.firstName,
      lastName: question.lastName,
      email: question.email,
      phone: question.phone,
      company: question.company,
      designation: question.designation,
      questions: [question],
    });
  }

  return [...groups.values()].sort((a, b) => {
    const aLatest = a.questions[a.questions.length - 1]?.createdAt ?? "";
    const bLatest = b.questions[b.questions.length - 1]?.createdAt ?? "";
    return new Date(bLatest).getTime() - new Date(aLatest).getTime();
  });
}

export function questionsForEmail(questions: Question[], email: string) {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  return questions.filter((question) => question.email.trim().toLowerCase() === needle);
}

export function questionsForViewer(
  questions: Question[],
  options: { isAdmin: boolean; email?: string; participantId?: string },
) {
  if (options.isAdmin) return questions;
  if (options.email) return questionsForEmail(questions, options.email);
  if (!options.participantId) return [];
  return questions.filter((question) => question.participantId === options.participantId);
}

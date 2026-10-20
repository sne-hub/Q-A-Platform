// lib/mappers.ts
import type { Participant, Profile, Question } from "./types";

export const profileToRow = (p: Profile) => ({
  first_name: p.firstName,
  last_name: p.lastName,
  email: p.email,
  phone: p.phone,
  company: p.company,
  designation: p.designation,
});

const rowToProfile = (r: any): Profile => ({
  firstName: r.first_name ?? "",
  lastName: r.last_name ?? "",
  email: r.email ?? "",
  phone: r.phone ?? "",
  company: r.company ?? "",
  designation: r.designation ?? "",
});

export const rowToParticipant = (r: any): Participant => ({
  ...rowToProfile(r),
  participantId: r.id,
  finished: r.finished,
  editedAt: r.edited_at ?? null,
});

export const rowToQuestion = (r: any): Question => ({
  ...rowToProfile(r),
  id: r.id,
  participantId: r.participant_id,
  body: r.body,
  createdAt: r.created_at,
  editedAt: r.edited_at ?? null,
});
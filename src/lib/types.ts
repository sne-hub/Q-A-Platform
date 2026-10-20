export const MAX_QUESTIONS_PER_PERSON = 3;

export type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
};

export type Participant = Profile & {
  participantId: string;
  finished: boolean;
  editedAt?: string | null; // set when the person edits their details
};

export type Question = Profile & {
  id: string;
  participantId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null; // set when the person edits this question
};

export type PersonGroup = Profile & {
  key: string;
  questions: Question[];
};

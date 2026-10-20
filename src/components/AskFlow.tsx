"use client";

import { FormEvent, useEffect, useState } from "react";
import { QuestionGroups } from "@/components/QuestionGroups";
import { MAX_QUESTIONS_PER_PERSON, type Participant, type Question } from "@/lib/types";

type Step = "details" | "questions" | "done";
type View = "questions" | "details";


const emptyProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  designation: "",
};

type Profile = typeof emptyProfile;

function profileFrom(p: Participant): Profile {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    company: p.company,
    designation: p.designation,
  };
}

function EditedTag() {
  return (
    <span className="badge" title="Changed after it was first saved">
      edited
    </span>
  );
}

export function AskFlow() {
  const [step, setStep] = useState<Step>("details");
  const [view, setView] = useState<View>("questions");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Inline editing state
  const [editingDetails, setEditingDetails] = useState(false);
  const [draftProfile, setDraftProfile] = useState<Profile>(emptyProfile);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");

  const remaining = Math.max(0, MAX_QUESTIONS_PER_PERSON - questions.length);

  function applySession(nextParticipant: Participant | null | undefined, nextQuestions: Question[]) {
    if (nextParticipant) {
      setParticipant(nextParticipant);
      setProfile(profileFrom(nextParticipant));
    }
    setQuestions(nextQuestions);
    const finished = nextParticipant?.finished ?? participant?.finished ?? false;
    setStep(finished || nextQuestions.length >= MAX_QUESTIONS_PER_PERSON ? "done" : "questions");
  }

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((data: { participant?: Participant | null; questions?: Question[] }) => {
        if (data.participant) applySession(data.participant, data.questions ?? []);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateDraftField(field: keyof Profile, value: string) {
    setDraftProfile((current) => ({ ...current, [field]: value }));
  }

  /* ---------- first-time details ---------- */

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save your details.");
        return;
      }
      applySession(data.participant, data.questions ?? []);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- questions ---------- */

  async function submitQuestion(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit that question.");
        return;
      }
      setBody("");
      const nextQuestions = (data.questions as Question[]) ?? [];
      setQuestions(nextQuestions);
      if (nextQuestions.length >= MAX_QUESTIONS_PER_PERSON) setStep("done");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function endQuestions() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/session/finish", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not end your questions.");
        return;
      }
      setParticipant(data.participant);
      setQuestions(data.questions ?? []);
      setStep("done");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reopenQuestions() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/session/finish", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not reopen your questions.");
        return;
      }
      setParticipant(data.participant);
      setQuestions(data.questions ?? []);
      setStep("questions");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEditQuestion(q: Question) {
    setError("");
    setEditingQuestionId(q.id);
    setDraftBody(q.body);
  }

  function cancelEditQuestion() {
    setEditingQuestionId(null);
    setDraftBody("");
  }

  async function saveQuestionEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingQuestionId) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/questions/${editingQuestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draftBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update that question.");
        return;
      }
      setQuestions((data.questions as Question[]) ?? []);
      cancelEditQuestion();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(q: Question) {
    if (!window.confirm("Delete this question? This can’t be undone.")) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/questions/${q.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete that question.");
        return;
      }
      if (editingQuestionId === q.id) cancelEditQuestion();
      applySession(data.participant ?? participant, (data.questions as Question[]) ?? []);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- details editing ---------- */

  function startEditDetails() {
    setError("");
    setDraftProfile(participant ? profileFrom(participant) : profile);
    setEditingDetails(true);
  }

  function cancelEditDetails() {
    setEditingDetails(false);
    setError("");
  }

  async function saveDetailsEdit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftProfile),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update your details.");
        return;
      }
      setParticipant(data.participant);
      setProfile(profileFrom(data.participant));
      if (data.questions) setQuestions(data.questions);
      setEditingDetails(false);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDetails() {
    const warning =
      questions.length > 0
        ? "Delete your details? This also deletes all of your submitted questions and can’t be undone."
        : "Delete your details? This can’t be undone.";
    if (!window.confirm(warning)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/session", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete your details.");
        return;
      }
      setParticipant(null);
      setQuestions([]);
      setProfile(emptyProfile);
      setBody("");
      setEditingDetails(false);
      cancelEditQuestion();
      setView("questions");
      setStep("details");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) {
    return <section className="panel">Loading…</section>;
  }

  return (
    <>
      <section className="panel">
        <div className="steps">
          <span className="step-pill" data-current={step === "details"}>
            1. Your details
          </span>

          <span className="step-pill" data-current={step !== "details"}>
            2. Your questions
          </span>
        </div>

        {step === "details" ? (
          <form className="form-grid" onSubmit={saveDetails}>
            <p className="hint">
              Enter your details first. You can then ask up to three questions, or stop
              earlier if you are done.
            </p>
            <ProfileFields values={profile} onChange={updateField} />
            {error ? <p className="error">{error}</p> : null}
            <div className="actions">
              <span className="hint">Required before you can ask anything.</span>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </button>
            </div>
          </form>
        ) : null}

        {step === "questions" && participant ? (
          <form className="form-grid" onSubmit={submitQuestion}>
            <p className="hint">
              Asking as {participant.firstName} {participant.lastName} ({participant.email}).
              You have {remaining} question{remaining === 1 ? "" : "s"} left.
            </p>
            <label>
              Question {questions.length + 1} of {MAX_QUESTIONS_PER_PERSON}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={600}
                required
                placeholder="What would you like the room to hear?"
              />
            </label>
            {error && !editingQuestionId && !editingDetails ? (
              <p className="error">{error}</p>
            ) : null}
            <div className="actions wrap">
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setView("details");
                  startEditDetails();
                }}
                disabled={busy}
              >
                Edit details
              </button>
              <button className="ghost" type="button" onClick={endQuestions} disabled={busy}>
                I have no more questions
              </button>
              <button className="primary" type="submit" disabled={busy || !body.trim()}>
                {busy ? "Sending…" : "Send question"}
              </button>
            </div>
          </form>
        ) : null}

     {step === "done" && participant ? (
  <div className="success">
    <h2>
      {questions.length >= MAX_QUESTIONS_PER_PERSON
        ? "That’s your three."
        : "Your questions are closed."}
    </h2>
    <p className="lede">
      Thanks, {participant.firstName} {participant.lastName}. Only you can see your
      questions and details below. Admins review the full list on the dashboard.
    </p>
    {error && !editingQuestionId && !editingDetails ? (
      <p className="error">{error}</p>
    ) : null}
    {questions.length < MAX_QUESTIONS_PER_PERSON ? (
      <div className="actions wrap">
        <button
          className="primary"
          type="button"
          onClick={reopenQuestions}
          disabled={busy}
        >
          {busy ? "Reopening…" : "Reopen"}
        </button>
      </div>
    ) : null}
  </div>
) : null}
      </section>

      {participant ? (
        <section className="own-questions">
          <div className="view-switch" role="tablist" aria-label="Your submissions"
            style={{
              display: "flex",
              alignItems: "center",
              columnGap: "16px"
            }}
          >
            <button
              type="button"
              role="tab"
              className="ghost"
              aria-selected={view === "questions"}
              data-current={view === "questions"}
              onClick={() => setView("questions")}
            >
              Your questions ({questions.length})
            </button>
            <button
              type="button"
              role="tab"
              className="ghost"
              aria-selected={view === "details"}
              data-current={view === "details"}
              onClick={() => setView("details")}
            >
              Your details
              {participant.editedAt ? <EditedTag /> : null}
            </button>
          </div>
          <br></br>
          {view === "questions" ? (
            <div role="tabpanel">
              <QuestionGroups
                questions={questions}
                empty="You have not submitted any questions yet."
                renderBody={(q, index) =>
                  editingQuestionId === q.id ? (
                    <form className="form-grid" onSubmit={saveQuestionEdit}>
                      <label>
                        Question {index + 1}
                        <textarea
                          value={draftBody}
                          onChange={(e) => setDraftBody(e.target.value)}
                          maxLength={600}
                          required
                          autoFocus
                        />
                      </label>
                      {error ? <p className="error">{error}</p> : null}
                      <div className="actions wrap">
                        <button
                          className="ghost"
                          type="button"
                          onClick={cancelEditQuestion}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                        <button
                          className="primary"
                          type="submit"
                          disabled={busy || !draftBody.trim() || draftBody === q.body}
                        >
                          {busy ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </form>
                  ) : null
                }
                renderActions={(q) =>
                  editingQuestionId === q.id ? null : (
                    <>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => startEditQuestion(q)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost danger"
                        type="button"
                        onClick={() => deleteQuestion(q)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </>
                  )
                }
              />
              {error && !editingQuestionId && !editingDetails ? (
                <p className="error">{error}</p>
              ) : null}
            </div>
          ) : (
            <div role="tabpanel">
              <div className="feed">
                <section className="group-card">
                  {editingDetails ? (
                    <form className="form-grid" onSubmit={saveDetailsEdit}>
                      <ProfileFields values={draftProfile} onChange={updateDraftField} />
                      {error ? <p className="error">{error}</p> : null}
                      <div className="actions wrap">
                        <button
                          className="ghost"
                          type="button"
                          onClick={cancelEditDetails}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                        <button className="primary" type="submit" disabled={busy}>
                          {busy ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <header className="group-head">
                        <div>
                          <h2>
                            {participant.firstName} {participant.lastName}
                          </h2>
                          <p className="meta">{participant.email}</p>
                          <p className="meta">
                            {participant.designation} · {participant.company} ·{" "}
                            {participant.phone}
                          </p>
                        </div>
                        {participant.editedAt ? <EditedTag /> : null}
                      </header>
                      {error ? <p className="error">{error}</p> : null}
                      <div className="actions wrap">
                        <button
                          className="ghost"
                          type="button"
                          onClick={startEditDetails}
                          disabled={busy}
                        >
                          Edit details
                        </button>
                        <button
                          className="ghost danger"
                          type="button"
                          onClick={deleteDetails}
                          disabled={busy}
                        >
                          Delete details
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}

function ProfileFields({
  values,
  onChange,
}: {
  values: Profile;
  onChange: (field: keyof Profile, value: string) => void;
}) {
  return (
    <div className="form-grid two">
      <label>
        First name
        <input
          value={values.firstName}
          onChange={(e) => onChange("firstName", e.target.value)}
          autoComplete="given-name"
          required
        />
      </label>
      <label>
        Last name
        <input
          value={values.lastName}
          onChange={(e) => onChange("lastName", e.target.value)}
          autoComplete="family-name"
          required
        />
      </label>
      <label>
        Email address
        <input
          type="email"
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label>
        Phone number
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          autoComplete="tel"
          required
        />
      </label>
      <label>
        Company
        <input
          value={values.company}
          onChange={(e) => onChange("company", e.target.value)}
          autoComplete="organization"
          required
        />
      </label>
      <label>
        Designation
        <input
          value={values.designation}
          onChange={(e) => onChange("designation", e.target.value)}
          autoComplete="organization-title"
          required
        />
      </label>
    </div>
  );
}

/*
 * Only this extra CSS is needed; everything else reuses your existing classes
 * (group-card, group-head, meta, badge, question-list, question-top, actions).
 *
 * .view-switch { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
 * .view-switch [data-current="true"] { font-weight: 600; }
 * .view-switch .badge { margin-left: 0.5rem; }
 * button.danger { color: #b3261e; }
 */
"use client";

import { FormEvent, useEffect, useState } from "react";
import { QuestionGroups } from "@/components/QuestionGroups";
import type { Question } from "@/lib/types";

export function DashboardLive() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch("/api/admin/login")
      .then((res) => res.json())
      .then((data: { ok?: boolean }) => {
        setAuthed(Boolean(data.ok));
      })
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!authed) return;
    let closed = false;
    const source = new EventSource("/api/questions/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { questions?: Question[] };
        if (!closed && Array.isArray(payload.questions)) {
          setQuestions(payload.questions);
        }
      } catch {
        // Ignore malformed frames.
      }
    };

    const poll = window.setInterval(async () => {
      if (source.readyState === EventSource.OPEN) return;
      try {
        const res = await fetch("/api/questions");
        const data = (await res.json()) as { questions?: Question[] };
        if (!closed && Array.isArray(data.questions)) {
          setQuestions(data.questions);
        }
      } catch {
        // Keep the last known list.
      }
    }, 2500);

    return () => {
      closed = true;
      source.close();
      window.clearInterval(poll);
    };
  }, [authed]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      setPassword("");
      setAuthed(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setQuestions([]);
    setConnected(false);
  }

  if (!ready) {
    return <section className="panel">Loading…</section>;
  }

  if (!authed) {
    return (
      <section className="panel">
        <h1>Admin dashboard</h1>
        <p className="lede">
          Sign in to see every question, grouped by name, surname, and email.
        </p>
        <form className="form-grid" onSubmit={login}>
          <label>
            Admin password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <span className="hint">Participants cannot see this list.</span>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  const people = new Set(
    questions.map(
      (question) =>
        `${question.firstName}|${question.lastName}|${question.email}`.toLowerCase(),
    ),
  ).size;

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="kicker">
            <span className="live-dot" aria-hidden />
            {connected ? "Live" : "Reconnecting"}
          </p>
          <h1>All questions</h1>
        </div>
        <div className="dash-stats">
          <div>
            <div className="count">{questions.length}</div>
            <p className="hint">question{questions.length === 1 ? "" : "s"}</p>
          </div>
          <div>
            <div className="count">{people}</div>
            <p className="hint">participant{people === 1 ? "" : "s"}</p>
          </div>
          <button className="ghost" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <QuestionGroups
        questions={questions}
        showContact
        empty="No questions yet. Participants submit them from the home page."
      />
    </>
  );
}

import type { ReactNode } from "react";
import { groupQuestions } from "@/lib/group";
import type { Question } from "@/lib/types";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function QuestionGroups({
  questions,
  showContact,
  empty,
  renderBody,
  renderActions,
}: {
  questions: Question[];
  showContact?: boolean;
  empty: string;
  /** Replace the question text (e.g. with an edit form). Return null to keep the default. */
  renderBody?: (question: Question, index: number) => ReactNode;
  /** Buttons shown under each question (e.g. Edit / Delete). Return null for none. */
  renderActions?: (question: Question, index: number) => ReactNode;
}) {
  const groups = groupQuestions(questions);

  if (groups.length === 0) {
    return <p className="empty">{empty}</p>;
  }

  return (
    <div className="feed">
      {groups.map((group) => (
        <section className="group-card" key={group.key}>
          <header className="group-head">
            <div>
              <h2>
                {group.firstName} {group.lastName}
              </h2>
              <p className="meta">{group.email}</p>
              {showContact ? (
                <p className="meta">
                  {group.designation} · {group.company} · {group.phone}
                </p>
              ) : null}
            </div>
            <span className="badge">
              {group.questions.length} question{group.questions.length === 1 ? "" : "s"}
            </span>
          </header>
          <ol className="question-list">
            {group.questions.map((question, index) => {
              const customBody = renderBody?.(question, index) ?? null;
              const actions = renderActions?.(question, index) ?? null;
              return (
                <li key={question.id}>
                  <div className="question-top">
                    <span>Q{index + 1}</span>
                    {question.editedAt ? <span className="badge">edited</span> : null}
                    <time dateTime={question.createdAt}>{formatWhen(question.createdAt)}</time>
                  </div>
                  {customBody ?? <p>{question.body}</p>}
                  {actions ? <div className="actions wrap">{actions}</div> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
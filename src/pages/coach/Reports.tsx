import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDecidedReports, useReports, useResolveReport } from "@/api/queries";
import { curatesAllContent, type Report, type User } from "@/api/types";
import { Badge, Button, buttonClass, ErrorMessage, RichText } from "@/components/ui";
import { reportReasonLabels } from "@/labels";

/**
 * The FEEDBACK tab of Coach's Corner: athletes' feedback on the signed-in user's exercises and on
 * exercises on their muscles (all of them, for staff). Who sent it is never shown.
 *
 * OPEN is what's left to decide, oldest first: a problem gets FIXED IT once the exercise is
 * corrected, DISMISS when there's nothing to fix; praise gets NOTED (it never benches an
 * exercise). DECIDED is the history, the latest decisions first, read-only. EDIT opens the
 * exercise (for its author, and staff) from either, since praise may come with a suggestion.
 */
export function Reports({ user }: { user: User }) {
  const [view, setView] = useState<"open" | "decided">("open");

  const toggleClass = (option: "open" | "decided") =>
    `border-2 border-line px-2 py-1 text-[11px] font-semibold ${
      view === option ? "bg-ink text-paper" : "bg-card hover:bg-muted"
    }`;

  return (
    <section>
      <div className="flex gap-2" role="group" aria-label="Which feedback">
        <button
          type="button"
          aria-pressed={view === "open"}
          onClick={() => setView("open")}
          className={toggleClass("open")}
        >
          open
        </button>
        <button
          type="button"
          aria-pressed={view === "decided"}
          onClick={() => setView("decided")}
          className={toggleClass("decided")}
        >
          decided
        </button>
      </div>
      <div className="mt-4">
        {view === "open" ? <OpenReports user={user} /> : <DecidedReports user={user} />}
      </div>
    </section>
  );
}

function OpenReports({ user }: { user: User }) {
  const { data: reports } = useReports();

  if (!reports) return null;
  if (reports.length === 0) {
    return (
      <p className="border-2 border-dashed border-ink/30 p-6 text-xs font-medium text-faded">
        // clean sheet: no open feedback on your exercises or muscles
      </p>
    );
  }

  return (
    <>
      <p className="text-xs font-semibold text-faded">
        <span className="text-amber-ink">{reports.length}</span> open · three problems on one
        exercise bench it until you decide; praise never does
      </p>

      <div className="pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-amber bg-card">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} user={user} />
        ))}
      </div>
    </>
  );
}

/** What became of decided feedback, in the words of the buttons that decided it. */
function outcomeOf(report: Report): string {
  if (report.status === "DISMISSED") return "DISMISSED";
  return report.reason === "PRAISE" ? "NOTED" : "FIXED";
}

function DecidedReports({ user }: { user: User }) {
  const { data: reports, error } = useDecidedReports(true);

  if (error) return <ErrorMessage error={error} />;
  if (!reports) return null;
  if (reports.length === 0) {
    return (
      <p className="border-2 border-dashed border-ink/30 p-6 text-xs font-medium text-faded">
        // nothing decided yet: feedback you fix, dismiss or note shows up here
      </p>
    );
  }

  return (
    <>
      <p className="text-xs font-semibold text-faded">
        the latest {reports.length} decided, newest first
      </p>
      <div className="pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-line bg-card">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} user={user} />
        ))}
      </div>
    </>
  );
}

/**
 * One piece of feedback: what it is about, what it says, the exercise behind a fold, and EDIT for
 * whoever may change the exercise, whose title then opens the exercise's page. Open feedback has
 * the buttons that decide it: NOTED for praise; FIXED IT or DISMISS for a problem. Decided
 * feedback shows its outcome and when instead. On the exercise's own page (`showExercise` false),
 * the exercise isn't repeated: no title, fold or EDIT.
 */
export function ReportCard({
  report,
  user,
  showExercise = true,
}: {
  report: Report;
  user: User;
  showExercise?: boolean;
}) {
  const resolveReport = useResolveReport();
  const praise = report.reason === "PRAISE";
  const open = report.status === "OPEN";
  const canEdit = report.question.createdBy === user.id || curatesAllContent(user.role);
  const decide = (decision: "RESOLVED" | "DISMISSED") =>
    resolveReport.mutate({ reportId: report.id, decision });

  return (
    <article className="p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-faded">
        <span
          className={`border-2 border-line px-2 py-0.5 ${
            praise ? "bg-pixel text-paper" : "bg-amber text-on-amber"
          }`}
        >
          {reportReasonLabels[report.reason]}
        </span>
        {showExercise && <span>#{report.question.id}</span>}
        <span>sent {new Date(report.reportedAt).toLocaleDateString()}</span>
        {report.resolvedAt && (
          <>
            <Badge color="muted">{outcomeOf(report)}</Badge>
            <span>{new Date(report.resolvedAt).toLocaleDateString()}</span>
          </>
        )}
      </div>

      {showExercise &&
        (canEdit ? (
          <Link
            to="/coach/exercises/$questionId"
            params={{ questionId: String(report.question.id) }}
            className="mt-3 block text-sm font-bold hover:underline"
            title="Its page: votes, all feedback, actions"
          >
            {report.question.title}
          </Link>
        ) : (
          <p className="mt-3 text-sm font-bold">{report.question.title}</p>
        ))}
      {report.note && (
        <p
          className={`mt-2 border-l-2 pl-3 text-xs break-words whitespace-pre-wrap text-ink/80 ${
            praise ? "border-pixel" : "border-amber"
          }`}
        >
          {report.note}
        </p>
      )}

      {showExercise && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold text-faded hover:text-ink">
            read the full exercise and model answer
          </summary>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="font-display text-[9px] text-ink/70">THE EXERCISE</p>
              <RichText text={report.question.requirement} className="mt-2" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[9px] text-ink/70">MODEL ANSWER</p>
              <RichText text={report.question.sampleSolution} className="mt-2 text-ink/80" />
            </div>
          </div>
        </details>
      )}

      {((showExercise && canEdit) || open) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {showExercise && canEdit && (
            <Link
              to="/coach"
              search={{ tab: "exercise", edit: report.question.id }}
              className={buttonClass("paper")}
            >
              EDIT
            </Link>
          )}
          {open &&
            (praise ? (
              <Button
                variant="pixel"
                disabled={resolveReport.isPending}
                onClick={() => decide("RESOLVED")}
                title="Read: thanks for the praise"
              >
                NOTED
              </Button>
            ) : (
              <>
                <Button
                  variant="pixel"
                  disabled={resolveReport.isPending}
                  onClick={() => decide("RESOLVED")}
                  title="The exercise is corrected"
                >
                  FIXED IT
                </Button>
                <Button
                  variant="paper"
                  disabled={resolveReport.isPending}
                  onClick={() => decide("DISMISSED")}
                  title="Nothing to fix"
                >
                  DISMISS
                </Button>
              </>
            ))}
        </div>
      )}
      <ErrorMessage error={resolveReport.error} />
    </article>
  );
}

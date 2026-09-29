import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ApiError } from "@/api/client";
import {
  useDeleteQuestion,
  useQuestion,
  useQuestionReports,
  useUpdateQuestionStatus,
} from "@/api/queries";
import { curatesAllContent, type User } from "@/api/types";
import { RequireSignIn } from "@/components/RequireSignIn";
import { Badge, Button, buttonClass, ErrorMessage, Loading, PageHeading } from "@/components/ui";
import { ExerciseCard, ModelAnswerCard } from "@/pages/rack/ExerciseRack";
import { ReportCard } from "./Reports";

const route = getRouteApi("/coach/exercises/$questionId");

/**
 * One exercise in Coach's Corner, for its author and staff: the exercise and its model answer, its
 * votes, all its feedback (open ones decided right here), and TRY IT, EDIT, BENCH and DELETE.
 * YOUR EXERCISES and the FEEDBACK tab link here from an exercise's title.
 */
export function ExercisePage() {
  return <RequireSignIn area="coach's corner">{(user) => <Exercise user={user} />}</RequireSignIn>;
}

function Exercise({ user }: { user: User }) {
  const { questionId } = route.useParams();
  const id = Number(questionId);
  const { data: question, isPending, error } = useQuestion(id);
  const { data: reports, error: reportsError } = useQuestionReports(id);
  const updateStatus = useUpdateQuestionStatus();
  const deleteQuestion = useDeleteQuestion();
  const navigate = useNavigate();
  const isStaff = curatesAllContent(user.role);
  const busy = updateStatus.isPending || deleteQuestion.isPending;

  // Not there, or not theirs: both read as "not in your coach's corner". While this page's own
  // DELETE finishes, the refetch's 404 is expected: keep showing the exercise until we leave.
  const notHere = error instanceof ApiError && (error.status === 403 || error.status === 404);
  const gone = notHere && !(deleteQuestion.isPending || deleteQuestion.isSuccess);

  if (isPending && !error) return <Loading what="unracking the exercise" />;
  if (error && !notHere) return <ErrorMessage error={error} />;
  if (!question || gone) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-ink/70">
          This exercise isn't in your coach's corner.
        </p>
        <Link to="/coach" search={{ tab: "yours" }} className={`${buttonClass("paper")} mt-6`}>
          BACK TO YOUR EXERCISES
        </Link>
      </div>
    );
  }

  const confirmDelete = () => {
    if (window.confirm(`Delete exercise #${question.id} for good? This can't be undone.`)) {
      deleteQuestion.mutate(question.id, {
        onSuccess: () => navigate({ to: "/coach", search: { tab: "yours" } }),
      });
    }
  };

  const open = reports?.filter((report) => report.status === "OPEN").length ?? 0;
  const decided = (reports?.length ?? 0) - open;

  return (
    <>
      <PageHeading prompt={`cat exercises/${question.id}`} title={`EXERCISE #${question.id}`}>
        Everything about one exercise: how athletes rate it, their feedback, and what you can do
        with it.
      </PageHeading>

      <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-faded">
        {question.status === "RETIRED" && <Badge color="muted">BENCHED</Badge>}
        {question.upVotes + question.downVotes > 0 ? (
          <span title="Athletes' votes on this exercise">
            <span className="text-pixel">▲ {question.upVotes}</span>{" "}
            <span className="text-danger">▼ {question.downVotes}</span>
          </span>
        ) : (
          <span>no votes yet</span>
        )}
      </p>

      {/* grid-cols-1, not a bare grid: the column then fits the screen instead of the widest code. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <ExerciseCard question={question} earlierSets={[]} />
        <ModelAnswerCard
          sampleSolution={question.sampleSolution}
          source={question.source}
          revealed
          onReveal={() => {}}
        />
      </div>

      {/* The buttons sit under what they act on. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/rack/$questionId"
          params={{ questionId: String(question.id) }}
          className={buttonClass("paper")}
          title="See it on the exercise rack, as athletes will"
        >
          TRY IT
        </Link>
        <Link
          to="/coach"
          search={{ tab: "exercise", edit: question.id }}
          className={buttonClass("paper")}
        >
          EDIT
        </Link>
        {isStaff &&
          (question.status === "RETIRED" ? (
            <Button
              variant="paper"
              disabled={busy}
              onClick={() => updateStatus.mutate({ id: question.id, status: "SUBMITTED" })}
              title="Back into workouts"
            >
              UNBENCH
            </Button>
          ) : (
            <Button
              variant="paper"
              disabled={busy}
              onClick={() => updateStatus.mutate({ id: question.id, status: "RETIRED" })}
              title="Out of every workout; answers and history are kept"
            >
              BENCH
            </Button>
          ))}
        {(isStaff || question.status === "DRAFT") && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={confirmDelete}
            title="Only while nobody has answered it; otherwise bench it"
          >
            DELETE
          </Button>
        )}
      </div>
      <ErrorMessage error={updateStatus.error ?? deleteQuestion.error} />

      <section className="mt-10">
        <h2 className="font-display text-xs">FEEDBACK</h2>
        {!reports ? (
          reportsError ? (
            <ErrorMessage error={reportsError} />
          ) : (
            <Loading what="reading the notes" />
          )
        ) : reports.length === 0 ? (
          <p className="mt-4 border-2 border-dashed border-ink/30 p-6 text-xs font-medium text-faded">
            // no feedback yet: athletes' notes on this exercise show up here
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs font-semibold text-faded">
              <span className="text-amber-ink">{open}</span> open · {decided} decided
            </p>
            <div className="pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-line bg-card">
              {reports.map((report) => (
                <ReportCard key={report.id} report={report} user={user} showExercise={false} />
              ))}
            </div>
          </>
        )}
      </section>

      <Link
        to="/coach"
        search={{ tab: "yours" }}
        className="mt-10 inline-block text-xs font-semibold text-faded hover:text-ink"
      >
        ← back to your exercises
      </Link>
    </>
  );
}

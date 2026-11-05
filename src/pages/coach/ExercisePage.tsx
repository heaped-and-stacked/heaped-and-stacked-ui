import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ApiError } from "@/api/client";
import {
  useDeleteQuestion,
  useQuestion,
  useQuestionReports,
  useUpdateQuestionStatus,
} from "@/api/queries";
import { curatesAllContent, type CurrentUser, type Question } from "@/api/types";
import { RequireSignIn } from "@/components/RequireSignIn";
import { ReviewerModeNeeded, useReviewer } from "@/components/ReviewerMode";
import { Badge, Button, buttonClass, Card, ErrorMessage, Loading, Prompt } from "@/components/ui";
import { ExerciseForm } from "./ExerciseForm";
import { isLive, MuscleChips } from "./MyExercises";
import { useRetry } from "../rack/TrainPage";
import { ReportCard } from "./Reports";

/** Where an exercise screen was opened from (besides a muscle's page, given as \`muscle\`). */
export type ExerciseFrom = "train" | "inbox" | "exercises";

/**
 * One screen for an exercise, new (/coach/exercises/new) or saved (/coach/exercises/<id>): the
 * form on the left; beside it, for a saved one, TRY IT, how athletes rate it, and BENCH and
 * DELETE; under it, its feedback. Saving or cancelling goes back where it was opened from: the
 * workout, a muscle's page, the inbox, or the exercises list.
 */
export function ExercisePage() {
  return (
    <RequireSignIn area="coach's corner">{(user) => <ExerciseScreen user={user} />}</RequireSignIn>
  );
}

function ExerciseScreen({ user }: { user: CurrentUser }) {
  const params = useParams({ strict: false }) as { questionId?: string };
  const { from, muscle } = useSearch({ strict: false }) as { from?: ExerciseFrom; muscle?: string };
  const navigate = useNavigate();
  const id = params.questionId ? Number(params.questionId) : undefined;
  const { data: question, isPending, error } = useQuestion(id);
  const { reviewing } = useReviewer();

  const back = () => {
    if (from === "train") return navigate({ to: "/train" });
    if (muscle) return navigate({ to: "/coach/muscles/$tag", params: { tag: muscle } });
    return navigate({ to: "/coach", search: { tab: from === "inbox" ? "inbox" : "exercises" } });
  };
  const backLabel =
    from === "train"
      ? "← back to the workout"
      : muscle
        ? `← back to #${muscle}`
        : from === "inbox"
          ? "← back to the inbox"
          : "← back to the exercises";

  if (id === undefined) {
    if (!user.canAddQuestions) {
      return <NotHere text="Only gym staff add exercises for now." onBack={back} />;
    }
    return (
      <Screen title="NEW EXERCISE" prompt="touch exercises/new" backLabel={backLabel} onBack={back}>
        <ExerciseForm key="new" muscle={muscle} user={user} onDone={() => back()} />
        <Card className="text-xs leading-relaxed text-ink/80">
          <h2 className="font-display text-[9px] text-ink/70">A GOOD EXERCISE</h2>
          <ul className="mt-3 grid gap-2">
            <li>▸ One question an interviewer would ask, answerable in a few minutes.</li>
            <li>▸ A sample set a senior would give: the point first, then why.</li>
            <li>▸ Code only where it carries the question.</li>
            <li>▸ A source, with its link, when the idea comes from somewhere.</li>
            <li>
              ▸ On a muscle someone else coaches, it waits for their yes before athletes get it.
            </li>
          </ul>
        </Card>
      </Screen>
    );
  }

  const notHere = error instanceof ApiError && (error.status === 403 || error.status === 404);
  if (isPending && !error) return <Loading what="unracking the exercise" />;
  if (error && !notHere) return <ErrorMessage error={error} />;
  if (!question) return <NotHere text="This exercise isn't one you can edit." onBack={back} />;
  // Someone else's exercise is curating: reviewer mode's.
  if (question.createdBy !== user.id && !reviewing) {
    return <ReviewerModeNeeded text="Someone else wrote this exercise." onBack={back} />;
  }

  return (
    <Screen
      title={`EXERCISE #${question.id}`}
      prompt={`vim exercises/${question.id}`}
      backLabel={backLabel}
      onBack={back}
      badge={question.status === "RETIRED" ? <Badge color="muted">BENCHED</Badge> : undefined}
    >
      <ExerciseForm key={question.id} editing={question} user={user} onDone={() => back()} />
      <SidePanel question={question} user={user} onDeleted={back} />
      <Feedback question={question} user={user} />
    </Screen>
  );
}

/** The screen's frame: the way back, the heading, then the form and its side panel. */
function Screen({
  title,
  prompt,
  backLabel,
  onBack,
  badge,
  children,
}: {
  title: string;
  prompt: string;
  backLabel: string;
  onBack: () => void;
  badge?: React.ReactNode;
  children: [React.ReactNode, React.ReactNode, React.ReactNode?];
}) {
  const [form, side, below] = children;
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="block text-left text-[11px] font-semibold text-blue underline decoration-blue/40 underline-offset-2 hover:decoration-blue"
      >
        {backLabel}
      </button>
      <header className="mt-6">
        <Prompt>{prompt}</Prompt>
        <h1 className="mt-6 flex flex-wrap items-center gap-3 font-display text-xl md:text-2xl">
          {title} {badge}
        </h1>
      </header>
      {/* The form takes the room; the side panel stays narrow, beside it on wide screens. */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">{form}</div>
        <aside className="grid gap-6 lg:sticky lg:top-28">{side}</aside>
      </div>
      {below}
    </>
  );
}

/** Beside a saved exercise: trying it, how athletes rate it, benching and deleting it. */
function SidePanel({
  question,
  user,
  onDeleted,
}: {
  question: Question;
  user: CurrentUser;
  onDeleted: () => void;
}) {
  const updateStatus = useUpdateQuestionStatus();
  const deleteQuestion = useDeleteQuestion();
  const retry = useRetry();
  const { reviewing } = useReviewer();
  // Benching and deleting are curating: staff, in reviewer mode.
  const isStaff = reviewing && curatesAllContent(user.role);
  const busy = updateStatus.isPending || deleteQuestion.isPending;

  const confirmDelete = () => {
    if (window.confirm(`Delete exercise #${question.id} for good? This can't be undone.`)) {
      deleteQuestion.mutate(question.id, { onSuccess: onDeleted });
    }
  };

  return (
    <Card className="text-xs">
      <h2 className="font-display text-[9px] text-ink/70">ON THE RACK</h2>
      <p className="mt-2 text-[11px] font-semibold">
        <MuscleChips question={question} />
      </p>
      {isLive(question) ? (
        <Button
          variant="paper"
          size="sm"
          className="mt-3 w-full"
          onClick={() => retry(question.id, question.conceptTags)}
          title="Train it on the rack, as athletes do: a workout on its muscles, this one first"
        >
          TRY IT
        </Button>
      ) : (
        <p className="mt-3 text-[11px] text-faded">
          {question.status === "RETIRED"
            ? "// benched: out of every workout"
            : question.declinedTags.length > 0 && question.conceptTags.length === 0
              ? "// declined: athletes don't get it. Pick the muscle again, or another one, to ask again"
              : "// waiting for a coach's yes: athletes don't get it yet"}
        </p>
      )}

      <h2 className="mt-6 font-display text-[9px] text-ink/70">ATHLETES</h2>
      <p className="mt-2 font-semibold" title="Athletes' votes on this exercise">
        {question.upVotes + question.downVotes > 0 ? (
          <>
            <span className="text-pixel">▲ {question.upVotes}</span>{" "}
            <span className="text-danger">▼ {question.downVotes}</span>
          </>
        ) : (
          <span className="text-faded">no votes yet</span>
        )}
      </p>

      {isStaff && (
        <>
          <h2 className="mt-6 font-display text-[9px] text-ink/70">MORE</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {isStaff &&
              (question.status === "RETIRED" ? (
                <Button
                  variant="paper"
                  size="sm"
                  disabled={busy}
                  onClick={() => updateStatus.mutate({ id: question.id, status: "SUBMITTED" })}
                  title="Back into workouts"
                >
                  UNBENCH
                </Button>
              ) : (
                <Button
                  variant="paper"
                  size="sm"
                  disabled={busy}
                  onClick={() => updateStatus.mutate({ id: question.id, status: "RETIRED" })}
                  title="Out of every workout; answers and history are kept"
                >
                  BENCH
                </Button>
              ))}
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={confirmDelete}
              title="Only while nobody has answered it; otherwise bench it"
            >
              DELETE
            </Button>
          </div>
        </>
      )}
      <ErrorMessage error={updateStatus.error ?? deleteQuestion.error} />
    </Card>
  );
}

/** Under the form: every piece of feedback on the exercise, open ones decided right here. */
function Feedback({ question, user }: { question: Question; user: CurrentUser }) {
  const { data: reports, error } = useQuestionReports(question.id);
  const open = reports?.filter((report) => report.status === "OPEN").length ?? 0;

  return (
    <section className="mt-10">
      <h2 className="font-display text-xs">FEEDBACK</h2>
      {!reports ? (
        error ? (
          <ErrorMessage error={error} />
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
            <span className="text-amber-ink">{open}</span> open · {reports.length - open} decided
          </p>
          <div className="pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-line bg-card">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} user={user} showExercise={false} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function NotHere({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <p className="text-sm font-medium text-ink/70">{text}</p>
      <button type="button" onClick={onBack} className={`${buttonClass("paper")} mt-6`}>
        BACK
      </button>
    </Card>
  );
}

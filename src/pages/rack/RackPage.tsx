import { getRouteApi, Link } from "@tanstack/react-router";
import { ApiError } from "@/api/client";
import { useQuestion } from "@/api/queries";
import { RequireSignIn } from "@/components/RequireSignIn";
import { buttonClass, ErrorMessage, Loading, PageHeading } from "@/components/ui";
import { ExerciseRack } from "./ExerciseRack";

const route = getRouteApi("/rack/$questionId");

/**
 * Authors (and staff, for any exercise) try out an exercise on the same rack athletes use
 * (TrainPage), without saving an answer.
 */
export function RackPage() {
  return <RequireSignIn area="exercise rack">{() => <PreviewRack />}</RequireSignIn>;
}

function PreviewRack() {
  const { questionId } = route.useParams();
  const { data: question, isPending, error } = useQuestion(Number(questionId));
  // Not there, or not theirs to try: both read as "not in your coach's corner".
  const notHere = error instanceof ApiError && (error.status === 403 || error.status === 404);

  if (isPending && !error) return <Loading what="loading the bar" />;
  if (error && !notHere) return <ErrorMessage error={error} />;
  if (!question) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-ink/70">
          This exercise isn't in your coach's corner.
        </p>
        <Link to="/coach" className={`${buttonClass("paper")} mt-6`}>
          BACK TO COACH'S CORNER
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeading prompt={`./rack --exercise=${question.id} --dry-run`} title="EXERCISE RACK">
        Preview: this is how athletes will see your exercise. Nothing you type here is saved.
      </PageHeading>
      <div className="mt-10">
        <ExerciseRack
          question={question}
          // A dry run: reveal the author's own model answer and save nothing.
          onSubmit={async () => ({
            sampleSolution: question.sampleSolution,
            source: question.source,
            answerId: null,
          })}
        />
      </div>
      <Link
        to="/coach"
        className="mt-10 inline-block text-xs font-semibold text-faded hover:text-ink"
      >
        ← back to coach's corner
      </Link>
    </>
  );
}

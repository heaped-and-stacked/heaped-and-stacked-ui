import { getRouteApi, Link } from "@tanstack/react-router";
import { usePreviousSets } from "@/api/queries";
import { gradeColor, LoadMeter } from "@/components/LoadMeter";
import { RequireSignIn } from "@/components/RequireSignIn";
import { Button, buttonClass, ErrorMessage, Loading, PageHeading } from "@/components/ui";
import { selfGradeLabel } from "@/labels";
import { SetReview } from "./rack/ExerciseRack";
import { useRetry } from "./rack/TrainPage";

const route = getRouteApi("/workouts/$questionId");

/**
 * The athlete's sets of one exercise, one at a time (REVIEW in Past Workouts): the exercise as it
 * read then, their answer as sent, and the model answer behind a click. OLDER / NEWER step through
 * the sets; ?set= picks one (none: the latest).
 */
export function SetReviewPage() {
  return <RequireSignIn area="past workouts">{() => <Review />}</RequireSignIn>;
}

function Review() {
  const { questionId } = route.useParams();
  const { set: setId } = route.useSearch();
  const navigate = route.useNavigate();
  const retry = useRetry();
  // Newest first.
  const { data: sets, isPending, error } = usePreviousSets(Number(questionId));

  if (isPending) return <Loading what="reading the log book" />;
  if (error) return <ErrorMessage error={error} />;

  // The set asked for, or else the latest.
  const set = sets.find((candidate) => candidate.id === setId) ?? sets[0];
  if (!set) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-ink/70">
          No sets of this exercise in your log book.
        </p>
        <Link to="/workouts" className={`${buttonClass("paper")} mt-6`}>
          BACK TO PAST WORKOUTS
        </Link>
      </div>
    );
  }

  const index = sets.indexOf(set);
  const older = sets[index + 1];
  const newer = sets[index - 1];
  const show = (id: number) => navigate({ search: { set: id } });

  return (
    <>
      <PageHeading prompt={`git show --set=${set.id}`} title="SET REVIEW">
        How this set went: your answer as you sent it, and the model answer when you want it.
      </PageHeading>

      {/* Buttons on the left, like every action on the rack. */}
      <nav aria-label="Sets of this exercise" className="mt-10 flex flex-wrap items-center gap-3">
        <Button variant="paper" disabled={!older} onClick={() => older && show(older.id)}>
          ◀ OLDER SET
        </Button>
        <span className="text-xs font-semibold text-faded">
          set <span className="text-ink">{sets.length - index}</span> of {sets.length}
        </span>
        <Button variant="paper" disabled={!newer} onClick={() => newer && show(newer.id)}>
          NEWER SET ▶
        </Button>
        <Button onClick={() => retry(set.question.id, set.question.conceptTags)}>
          ANOTHER SET
        </Button>
      </nav>

      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-faded">
        <span className="text-ink">
          {new Date(set.answeredAt).toLocaleDateString("en", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        {set.selfGrade !== null ? (
          <span className="inline-flex items-center gap-2">
            <LoadMeter load={set.selfGrade} colorOf={gradeColor} />
            {selfGradeLabel(set.selfGrade)} · {set.selfGrade}/10
          </span>
        ) : (
          <span className="font-normal">form not graded</span>
        )}
        {set.perceivedDifficulty !== null && <span>felt {set.perceivedDifficulty}/10</span>}
      </p>

      <div className="mt-6">
        <SetReview key={set.id} set={set} />
      </div>

      <Link
        to="/workouts"
        className="mt-10 inline-block text-xs font-semibold text-faded hover:text-ink"
      >
        ← back to past workouts
      </Link>
    </>
  );
}

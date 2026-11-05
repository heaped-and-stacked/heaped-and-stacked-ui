import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ApiError, signInAndReturnTo } from "@/api/client";
import {
  useChosenExercise,
  useCurrentUser,
  useNextExercise,
  usePreviousSets,
  useReviewExercise,
  useSubmitAnswer,
} from "@/api/queries";
import {
  curatesAllContent,
  type QuestionPool,
  type LearningQuestion,
  type User,
} from "@/api/types";
import { Button, Card, ErrorMessage, Loading, Prompt } from "@/components/ui";
import { useReviewer } from "@/components/ReviewerMode";
import { useWorkoutMuscles, useWorkoutPool } from "@/components/WorkoutBar";
import { ExerciseRack, type SubmitResult } from "./ExerciseRack";

/**
 * A workout: one exercise at a time for the muscles picked in the workout bar (none picked =
 * all muscles). On top of the rack: SWAP EXERCISE (NEXT EXERCISE once the set is done), and
 * ← PREVIOUS back to an exercise moved past, with its draft or set as it was left. The API picks each one: exercises new to the athlete first, then done ones at
 * random, the longer ago the likelier. Exercises seen in this round (done or swapped) are
 * skipped; once every exercise in the pick was shown, another round starts. A workout never ends
 * by itself: the athlete decides with FINISH. The pick can change mid-workout: the current
 * exercise stays, and the next one comes from the new pick.
 *
 * The workout survives leaving the page: it's kept in the tab's session storage, so the rack (top
 * bar: TRAINING RACK) resumes the current exercise, draft answer and result. FINISH ends it. A
 * resumed exercise is checked against the server first; if its id now holds another exercise
 * (the database was reloaded), a new round starts instead; otherwise it shows the exercise as the
 * server has it now, so improved text shows up on a reload.
 *
 * Visitors may train too: they get exercises and write answers, and SUBMIT SET signs them in
 * first. Their workout, draft included, carries over to the account they sign in with.
 *
 * ANOTHER SET in Past Workouts (useRetry) starts a workout on an exercise's muscles with that
 * exercise first; then it goes on like any workout.
 *
 * Curating is training with a check: in reviewer mode (the TO VERIFY pool) the API serves
 * the exercises still to verify, picked as in any workout. A curator may REVIEW one (the sample set without
 * answering; no set is saved), then ✓ VERIFY it (on to the next) or ✎ FIX it (the edit screen,
 * back here after). Outside it, an unverified exercise they may verify gets the same.
 */
export function TrainPage() {
  const { data: user, isPending, error } = useCurrentUser();

  if (isPending) return <Loading what="checking your membership card" />;
  if (error) return <ErrorMessage error={error} />;
  return <Workout user={user} />;
}

/** The workout in progress. `current`: undefined = none asked for yet, null = nothing left. */
type WorkoutSession = {
  /** Whose workout it is; null for a visitor's, which the next account to sign in adopts. */
  userId: number | null;
  current: LearningQuestion | null | undefined;
  /**
   * The muscles picked when `current` was fetched: its count of new exercises is for these. The
   * pick can change mid-workout, and only the next exercise comes from the new one.
   */
  pick?: string[];
  /** The pool `current` was drawn from: its count (new ones, or left to verify) is for that. */
  pickPool?: QuestionPool;
  seen: number[];
  /** An exercise chosen to train first (ANOTHER SET in Past Workouts); then the API picks. */
  first?: number;
  /** A line for the athlete above the rack, e.g. that the chosen exercise is out of workouts now. */
  notice?: string;
  setsDone: number;
  draft: string;
  result: SubmitResult | null;
  /** The exercises moved past (SWAP, NEXT), newest last: ← PREVIOUS brings one back as it was left. */
  back?: BackStep[];
};

/** An exercise moved past, with what the athlete had done on it. */
type BackStep = Pick<WorkoutSession, "current" | "pick" | "pickPool" | "draft" | "result">;

/** How far ← PREVIOUS reaches back. */
const BACK_STEPS = 20;

const SESSION_KEY = "hs.workout.session";

/**
 * ANOTHER SET in Past Workouts, and TRY IT in Coach's Corner: a new workout on the exercise's
 * muscles that serves it first, then goes on as usual. Replaces a workout in progress.
 */
export function useRetry() {
  const navigate = useNavigate();
  const { pickOnly } = useWorkoutMuscles();
  const { data: user } = useCurrentUser();
  return (exerciseId: number, muscles: string[]) => {
    pickOnly(muscles);
    writeSession({
      userId: user?.id ?? null,
      current: undefined,
      seen: [],
      first: exerciseId,
      setsDone: 0,
      draft: "",
      result: null,
    });
    navigate({ to: "/train" });
  };
}

/**
 * TRAIN THE N TO VERIFY on a muscle's page: a new workout on those muscles from the pool to
 * verify. Replaces a workout in progress.
 */
export function useTrainToVerify() {
  const navigate = useNavigate();
  const { pickOnly } = useWorkoutMuscles();
  const { data: user } = useCurrentUser();
  const { setReviewing } = useReviewer();
  return (muscles: string[]) => {
    // The pool to verify is reviewer mode's: a muscle's owner gets there from this button.
    setReviewing(true);
    pickOnly(muscles);
    writeSession({
      userId: user?.id ?? null,
      current: undefined,
      seen: [],
      setsDone: 0,
      draft: "",
      result: null,
    });
    navigate({ to: "/train" });
  };
}

/** A convenience only: a browser without storage just starts a new workout. */
function readSession(userId: number | null): WorkoutSession {
  const fresh: WorkoutSession = {
    userId,
    current: undefined,
    seen: [],
    setsDone: 0,
    draft: "",
    result: null,
  };
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) ?? "null",
    ) as WorkoutSession | null;
    // A visitor's workout goes on after they sign in (that's what SUBMIT SET asks them to do).
    return stored && (stored.userId === userId || stored.userId === null)
      ? { ...stored, userId }
      : fresh;
  } catch {
    return fresh;
  }
}

function writeSession(session: WorkoutSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Not stored: the workout lasts until the page is left.
  }
}

/** `user` is null for a visitor. */
function Workout({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const { muscles } = useWorkoutMuscles();
  const { pool, reviewing } = useWorkoutPool();
  const { setReviewing } = useReviewer();
  const next = useNextExercise();
  const chosen = useChosenExercise();
  const whole = useReviewExercise();
  const [session, setSession] = useState(() => readSession(user?.id ?? null));
  // A new sample set for the same exercise: the rack keeps what it was given, so it starts again.
  const [resultVersion, setResultVersion] = useState(0);

  const update = (change: Partial<WorkoutSession>) =>
    setSession((previous) => {
      const updated = { ...previous, ...change };
      writeSession(updated);
      return updated;
    });

  // `from`: the pool after leaving reviewer mode (the hook's value is stale here).
  const askNext = (seen: number[], notice?: string, from = pool) => {
    update({ seen, current: undefined, draft: "", result: null, notice });
    next.mutate(
      { concepts: muscles, skip: seen, pool: from },
      {
        onSuccess: (exercise) => {
          if (exercise || seen.length === 0) {
            update({ current: exercise, pick: muscles, pickPool: from });
          } else {
            // Everything in the pick was shown: start another round, so the athlete decides when
            // the workout ends. Only the exercise just done is left out, if there's another one.
            askNext(seen.length > 1 ? seen.slice(-1) : [], undefined, from);
          }
        },
      },
    );
  };

  // The chosen exercise first; one benched since is skipped, with a word why.
  const askChosen = (id: number) => {
    update({ first: undefined });
    chosen.mutate(
      { id, concepts: muscles, pool },
      {
        onSuccess: (exercise) => update({ current: exercise, pick: muscles, pickPool: pool }),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) {
            chosen.reset();
            askNext(
              [],
              "// that exercise isn't in workouts (benched, or not accepted for a muscle yet), so here's another one",
            );
          }
        },
      },
    );
  };

  // A resumed exercise is shown as the server has it now: its text may have been improved since,
  // also by staff editing it from this workout (✎ FIX). Gone (deleted, or no longer in workouts):
  // a new round starts. Verified meanwhile (SAVE & VERIFY) while verifying: on to the next, unless
  // a set was written: it's still there to rate. A revealed sample set is shown as it is now too.
  const checkResumed = (resumed: LearningQuestion) => {
    const startOver = () =>
      askNext([], "// the exercises changed since this workout started, so here's a new one");
    chosen.mutate(
      {
        id: resumed.id,
        concepts: session.pick ?? muscles,
        pool: session.pickPool ?? pool,
      },
      {
        onSuccess: (exercise) => {
          const setWritten = session.result?.answerId != null;
          if ((session.pickPool ?? pool) === "TO_VERIFY" && exercise.verified && !setWritten) {
            askNext([...session.seen, exercise.id]);
            return;
          }
          update({ current: exercise });
          const { result } = session;
          if (result && (reviewing || exercise.canVerify)) {
            whole.mutate(exercise.id, {
              onSuccess: ({ sampleSolution, source }) => {
                update({ result: { ...result, sampleSolution, source } });
                setResultVersion((version) => version + 1);
              },
            });
          }
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) {
            chosen.reset();
            startOver();
          }
        },
      },
    );
  };

  // A new workout asks for its first exercise (the chosen one, if any); a resumed one has it.
  useEffect(() => {
    if (session.current) {
      if (user) checkResumed(session.current);
      return;
    }
    if (session.current !== undefined) return;
    if (session.first !== undefined) askChosen(session.first);
    else askNext(session.seen);
  }, []);

  // SWAP and NEXT: on to another exercise, keeping this one (draft or set) for ← PREVIOUS.
  const moveOn = () => {
    if (!session.current) return;
    const { current, pick, pickPool, draft, result } = session;
    update({
      back: [...(session.back ?? []), { current, pick, pickPool, draft, result }].slice(
        -BACK_STEPS,
      ),
    });
    askNext([...session.seen, session.current.id]);
  };

  // ← PREVIOUS: the exercise before, as it was left. The one on the rack counts as seen (skipped).
  const back = session.back ?? [];
  const previous = () => {
    const step = back[back.length - 1];
    if (!step) return;
    update({
      ...step,
      back: back.slice(0, -1),
      seen: session.current ? [...session.seen, session.current.id] : session.seen,
      notice: undefined,
    });
  };

  const finish = () => {
    writeSession(null);
    navigate({ to: "/workouts" });
  };

  const { current, setsDone } = session;
  const currentPool = session.pickPool ?? pool;
  // The bar changed since this exercise was drawn: it stays, the next one follows the new pick.
  const musclesChanged =
    session.pick !== undefined && [...session.pick].sort().join() !== [...muscles].sort().join();
  const poolChanged = session.pickPool !== undefined && session.pickPool !== pool;
  const changed = [musclesChanged && "the muscles", poolChanged && "which exercises"]
    .filter(Boolean)
    .join(" and ");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Prompt>
          ./train --muscles={muscles.length > 0 ? muscles.join(",") : "all"}
          {pool === "TO_VERIFY" && " --to-verify"}
        </Prompt>
        <p className="text-[11px] font-semibold text-faded">
          sets done this workout: <span className="text-ink">{setsDone}</span>
        </p>
      </div>

      <div className="mt-6">
        {current === undefined && (next.isPending || chosen.isPending) && (
          <Loading what="loading the bar" />
        )}
        <ErrorMessage error={next.error ?? chosen.error} />
        {/* Moving between exercises sits on top, so skimming through them needs no scrolling. */}
        {current && (
          <div className="mb-4 flex flex-wrap gap-3">
            {back.length > 0 && (
              <Button
                variant="paper"
                size="sm"
                onClick={previous}
                title="Back to the exercise before, as you left it"
              >
                ← PREVIOUS
              </Button>
            )}
            <Button
              variant="paper"
              size="sm"
              onClick={moveOn}
              title={
                session.result
                  ? "On to the next exercise"
                  : "Skip this one for another; ← PREVIOUS brings it back"
              }
            >
              {session.result ? "NEXT EXERCISE →" : "SWAP EXERCISE →"}
            </Button>
          </div>
        )}
        {session.notice && (
          <p className="mb-4 text-[11px] font-semibold text-faded">{session.notice}</p>
        )}
        {current && changed && (
          <p role="status" className="mb-4 text-[11px] font-semibold text-amber-ink">
            {`// you changed ${changed}: this exercise is from your earlier pick, the next one follows the new one`}
          </p>
        )}

        {current && (
          <WorkoutRack
            key={`${current.id}-${resultVersion}`}
            question={current}
            signedIn={user !== null}
            canEdit={reviewing && user !== null && curatesAllContent(user.role)}
            reviewing={reviewing}
            muscles={session.pick ?? muscles}
            pool={currentPool}
            initialAnswer={session.draft}
            initialResult={session.result}
            onDraftChange={(draft) => update({ draft })}
            onSetDone={(result) => update({ result, setsDone: setsDone + 1 })}
            onReviewed={(result) => update({ result })}
            onMoveOn={moveOn}
            onFinish={finish}
          />
        )}

        {current === null && (
          <Card className="mx-auto mt-6 w-full max-w-md text-center">
            <p className="font-display text-xs">RACK IS EMPTY</p>
            {currentPool === "TO_VERIFY" ? (
              <p className="mt-4 text-sm font-medium leading-relaxed text-ink/70">
                Nothing left to verify on these muscles: every exercise you check here is verified.
                Pick other muscles in the bar above, or leave reviewer mode to train.
              </p>
            ) : (
              <p className="mt-4 text-sm font-medium leading-relaxed text-ink/70">
                No exercises for these muscles yet. Add more muscles in the bar above, or coach an
                exercise yourself.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {currentPool === "TO_VERIFY" ? (
                <Button
                  onClick={() => {
                    setReviewing(false);
                    askNext([], undefined, "ALL");
                  }}
                >
                  LEAVE REVIEWER MODE
                </Button>
              ) : null}
              <Button variant={currentPool === "TO_VERIFY" ? "paper" : undefined} onClick={finish}>
                PAST WORKOUTS
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

/**
 * The rack for one exercise, with the athlete's previous sets of it to compare against, and how
 * far they are through the picked muscles: how many exercises are still new to them, a
 * congratulation when the last new one is done, and a note that only repeats are left after that.
 * From the pool to verify, it says how many are left to verify instead.
 */
function WorkoutRack({
  question,
  signedIn,
  canEdit,
  muscles,
  pool,
  initialAnswer,
  initialResult,
  onDraftChange,
  onSetDone,
  onReviewed,
  reviewing,
  onMoveOn,
  onFinish,
}: {
  question: LearningQuestion;
  /** The pool it was drawn from: the counts are for that. */
  pool: QuestionPool;
  /** false for a visitor: no previous sets, and SUBMIT SET signs in first. */
  signedIn: boolean;
  /** Staff may edit the exercise from the rack, and come back to this workout after. */
  canEdit: boolean;
  /** The muscles this exercise was picked for (none = all muscles): its count of new ones is for these. */
  muscles: string[];
  initialAnswer: string;
  /** The outcome of this exercise's set, once submitted (kept by the workout). */
  initialResult: SubmitResult | null;
  onDraftChange: (draft: string) => void;
  onSetDone: (result: SubmitResult) => void;
  /** REVIEW: the sample set, read without a set (kept by the workout). */
  onReviewed: (result: SubmitResult) => void;
  /** Reviewer mode: REVIEW and CHECKED IT? on exercises still to verify. */
  reviewing: boolean;
  onMoveOn: () => void;
  onFinish: () => void;
}) {
  const submitAnswer = useSubmitAnswer();
  const reviewExercise = useReviewExercise();
  const toVerify = pool === "TO_VERIFY";
  const { data: storedSets } = usePreviousSets(question.id, signedIn);
  // A visitor has done nothing yet: every exercise is new to them.
  const previousSets = signedIn ? storedSets : [];

  // New to the athlete: no set of it apart from the one just submitted. Unknown while loading.
  const isNew =
    previousSets === undefined
      ? undefined
      : previousSets.every((set) => set.id === initialResult?.answerId);
  // The API counts this exercise among the new ones until it's answered.
  const newLeft = question.unansweredCount - (isNew && initialResult ? 1 : 0);
  const pick = muscles.length > 0 ? muscles.map((tag) => `#${tag}`).join(" ") : "all muscles";
  // From the pool to verify, the API counts every exercise left to verify; this one is among them
  // unless it was chosen (TRY IT, ANOTHER SET) and is verified already, or isn't the athlete's to verify.
  const leftToVerify = question.unansweredCount;
  const oneToVerify = question.canVerify && !question.verified;

  return (
    <>
      {toVerify ? (
        <p className="mb-4 text-[11px] font-semibold text-faded">
          {oneToVerify
            ? `// to verify · ${leftToVerify} left for ${pick}, this one included`
            : `// ${leftToVerify} left to verify for ${pick}`}
        </p>
      ) : isNew && initialResult && newLeft === 0 ? (
        <Card className="mb-6 bg-amber/30">
          <p className="font-display text-xs">MUSCLE MAXED OUT</p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-ink/80">
            You've done every exercise for {pick} at least once. From here on it's repeats: the
            longer ago you did one, the sooner it comes back. New exercises jump the queue as soon
            as coaches add them.
          </p>
        </Card>
      ) : (
        isNew !== undefined && (
          <p className="mb-4 text-[11px] font-semibold text-faded">
            {/* How many are left is curator information: counts only in reviewer mode. */}
            {isNew
              ? reviewing
                ? initialResult
                  ? `// ${newLeft} new exercise${newLeft === 1 ? "" : "s"} left for ${pick}`
                  : `// new to you · ${newLeft} new exercise${newLeft === 1 ? "" : "s"} left for ${pick}, this one included`
                : "// new to you"
              : newLeft === 0
                ? `// a repeat: you've done every exercise for ${pick} at least once`
                : reviewing
                  ? `// a repeat · ${newLeft} new exercise${newLeft === 1 ? "" : "s"} left for ${pick}`
                  : "// a repeat"}
          </p>
        )
      )}
      {!signedIn && (
        <p className="mb-4 text-[11px] font-semibold text-faded">
          // trying it out? write your answer, then sign in with GitHub to log the set and see the
          sample set.
        </p>
      )}
      <ExerciseRack
        question={question}
        previousSets={previousSets ?? []}
        initialAnswer={initialAnswer}
        initialResult={initialResult}
        onDraftChange={onDraftChange}
        submitLabel={signedIn ? undefined : "SIGN IN TO SUBMIT"}
        feedback={signedIn}
        canEdit={canEdit}
        onSubmit={async (answer) => {
          if (!signedIn) {
            // The draft is already kept with the workout; back on the rack after signing in.
            signInAndReturnTo("/train");
            return new Promise<SubmitResult>(() => {}); // the page is leaving
          }
          const saved = await submitAnswer.mutateAsync({ questionId: question.id, answer });
          const result = {
            sampleSolution: saved.question.sampleSolution,
            source: saved.question.source,
            answerId: saved.id,
          };
          onSetDone(result);
          return result;
        }}
        onReview={
          reviewing && signedIn && question.canVerify && !question.verified
            ? async () => {
                const whole = await reviewExercise.mutateAsync(question.id);
                const result = {
                  sampleSolution: whole.sampleSolution,
                  source: whole.source,
                  answerId: null,
                };
                onReviewed(result);
                return result;
              }
            : undefined
        }
        onVerified={reviewing ? onMoveOn : undefined}
        onNext={onMoveOn}
        onFinish={onFinish}
      />
    </>
  );
}

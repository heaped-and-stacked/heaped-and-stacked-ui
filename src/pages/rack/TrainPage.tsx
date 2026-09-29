import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ApiError, signInAndReturnTo } from "@/api/client";
import {
  useChosenExercise,
  useCurrentUser,
  useNextExercise,
  usePreviousSets,
  useSubmitAnswer,
} from "@/api/queries";
import type { LearningQuestion, User } from "@/api/types";
import { Button, Card, ErrorMessage, Loading, Prompt } from "@/components/ui";
import { useWorkoutMuscles } from "@/components/WorkoutBar";
import { ExerciseRack, type SubmitResult } from "./ExerciseRack";

/**
 * A workout: one exercise at a time for the muscles picked in the workout bar (none picked =
 * all muscles). The API picks each one: exercises new to the athlete first, then done ones at
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
  seen: number[];
  /** An exercise chosen to train first (ANOTHER SET in Past Workouts); then the API picks. */
  first?: number;
  /** A line for the athlete above the rack, e.g. that the chosen exercise is out of workouts now. */
  notice?: string;
  setsDone: number;
  draft: string;
  result: SubmitResult | null;
};

const SESSION_KEY = "hs.workout.session";

/**
 * ANOTHER SET in Past Workouts: a new workout on the exercise's muscles that serves it first,
 * then goes on as usual. Replaces a workout in progress.
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
  const next = useNextExercise();
  const chosen = useChosenExercise();
  const [session, setSession] = useState(() => readSession(user?.id ?? null));

  const update = (change: Partial<WorkoutSession>) =>
    setSession((previous) => {
      const updated = { ...previous, ...change };
      writeSession(updated);
      return updated;
    });

  const askNext = (seen: number[], notice?: string) => {
    update({ seen, current: undefined, draft: "", result: null, notice });
    next.mutate(
      { concepts: muscles, skip: seen },
      {
        onSuccess: (exercise) => {
          if (exercise || seen.length === 0) {
            update({ current: exercise, pick: muscles });
          } else {
            // Everything in the pick was shown: start another round, so the athlete decides when
            // the workout ends. Only the exercise just done is left out, if there's another one.
            askNext(seen.length > 1 ? seen.slice(-1) : []);
          }
        },
      },
    );
  };

  // The chosen exercise first; one benched since is skipped, with a word why.
  const askChosen = (id: number) => {
    update({ first: undefined });
    chosen.mutate(
      { id, concepts: muscles },
      {
        onSuccess: (exercise) => update({ current: exercise, pick: muscles }),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) {
            askNext([], "// that exercise is out of workouts now (benched), so here's another one");
          }
        },
      },
    );
  };

  // A resumed exercise is checked against the server: after the database was reloaded, its id can
  // belong to another exercise, and a set would be saved under that one. Then a new round starts.
  // The same exercise is shown as the server has it now: its text may have been improved since.
  const checkResumed = (resumed: LearningQuestion) => {
    const startOver = () =>
      askNext([], "// the exercises changed since this workout started, so here's a new one");
    chosen.mutate(
      { id: resumed.id, concepts: session.pick ?? muscles },
      {
        onSuccess: (exercise) => {
          if (exercise.title !== resumed.title) startOver();
          else update({ current: exercise });
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

  const moveOn = () => {
    if (session.current) askNext([...session.seen, session.current.id]);
  };

  const finish = () => {
    writeSession(null);
    navigate({ to: "/workouts" });
  };

  const { current, setsDone } = session;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Prompt>./train --muscles={muscles.length > 0 ? muscles.join(",") : "all"}</Prompt>
        <p className="text-[11px] font-semibold text-faded">
          sets done this workout: <span className="text-ink">{setsDone}</span>
        </p>
      </div>

      <div className="mt-6">
        {current === undefined && (next.isPending || chosen.isPending) && (
          <Loading what="loading the bar" />
        )}
        <ErrorMessage error={next.error ?? chosen.error} />
        {session.notice && (
          <p className="mb-4 text-[11px] font-semibold text-faded">{session.notice}</p>
        )}

        {current && (
          <WorkoutRack
            key={current.id}
            question={current}
            signedIn={user !== null}
            muscles={session.pick ?? muscles}
            initialAnswer={session.draft}
            initialResult={session.result}
            onDraftChange={(draft) => update({ draft })}
            onSetDone={(result) => update({ result, setsDone: setsDone + 1 })}
            onMoveOn={moveOn}
            onFinish={finish}
          />
        )}

        {current === null && (
          <Card className="mx-auto mt-6 w-full max-w-md text-center">
            <p className="font-display text-xs">RACK IS EMPTY</p>
            <p className="mt-4 text-sm font-medium leading-relaxed text-ink/70">
              No exercises for these muscles yet. Add more muscles in the bar above, or coach an
              exercise yourself.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button onClick={finish}>PAST WORKOUTS</Button>
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
 */
function WorkoutRack({
  question,
  signedIn,
  muscles,
  initialAnswer,
  initialResult,
  onDraftChange,
  onSetDone,
  onMoveOn,
  onFinish,
}: {
  question: LearningQuestion;
  /** false for a visitor: no previous sets, and SUBMIT SET signs in first. */
  signedIn: boolean;
  /** The muscles this exercise was picked for (none = all muscles): its count of new ones is for these. */
  muscles: string[];
  initialAnswer: string;
  /** The outcome of this exercise's set, once submitted (kept by the workout). */
  initialResult: SubmitResult | null;
  onDraftChange: (draft: string) => void;
  onSetDone: (result: SubmitResult) => void;
  onMoveOn: () => void;
  onFinish: () => void;
}) {
  const submitAnswer = useSubmitAnswer();
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

  return (
    <>
      {isNew && initialResult && newLeft === 0 ? (
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
            {isNew
              ? initialResult
                ? `// ${newLeft} new ${newLeft === 1 ? "exercise" : "exercises"} left for ${pick}`
                : `// new to you · ${newLeft} new left for ${pick}, this one included`
              : newLeft === 0
                ? `// a repeat: you've done every exercise for ${pick} at least once`
                : `// a repeat · ${newLeft} new left for ${pick}`}
          </p>
        )
      )}
      {!signedIn && (
        <p className="mb-4 text-[11px] font-semibold text-faded">
          // trying it out? write your answer, then sign in with GitHub to log the set and see the
          model answer. your answer waits for you.
        </p>
      )}
      <ExerciseRack
        question={question}
        previousSets={previousSets ?? []}
        initialAnswer={initialAnswer}
        initialResult={initialResult}
        onDraftChange={onDraftChange}
        submitLabel={signedIn ? undefined : "SIGN IN & SUBMIT"}
        feedback={signedIn}
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
        onSwap={onMoveOn}
        onNext={onMoveOn}
        onFinish={onFinish}
      />
    </>
  );
}

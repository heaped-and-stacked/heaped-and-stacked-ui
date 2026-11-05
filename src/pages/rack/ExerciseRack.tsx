import { Link } from "@tanstack/react-router";
import { signInAndReturnTo } from "@/api/client";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  useAssessAnswer,
  useMyFeedback,
  useReportExercise,
  useUpdateMyFeedback,
  useVerifyExercise,
  useVoteOnExercise,
  useWithdrawMyFeedback,
} from "@/api/queries";
import type { Answer, LearningQuestion, ReportReason, Vote } from "@/api/types";
import { gradeColor, LoadMeter, PlatePicker } from "@/components/LoadMeter";
import {
  Badge,
  Button,
  buttonClass,
  Card,
  codeBlocksOf,
  ErrorMessage,
  fieldFrameClass,
  indentOnTab,
  RichText,
  withLinks,
} from "@/components/ui";
import { reportReasonLabels, selfGradeLabel } from "@/labels";

/** What the rack shows of an exercise before it's answered: never the sample set. */
export type RackQuestion = Pick<
  LearningQuestion,
  "id" | "title" | "requirement" | "difficultyScore" | "conceptTags"
> &
  Partial<Pick<LearningQuestion, "upVotes" | "downVotes" | "myVote" | "verified" | "canVerify">>;

/**
 * What comes back once a set is submitted. No answerId means nothing was saved: a curator's REVIEW.
 */
export type SubmitResult = {
  sampleSolution: string;
  source: string | null;
  answerId: number | null;
};

/** The self-assessment values that save on their own, each with its "✓ SAVED" marker. */
type AssessmentRow = "form" | "felt";

/**
 * Where an athlete solves one exercise: full-width cards, one under the other, in the order the
 * athlete goes through them:
 *   THE EXERCISE     what to do. With `feedback` on (signed in) the card
 *                    ends with how the exercise felt, the athlete's vote and a note to its coach
 *                    (ExerciseFeedback); otherwise its ▲ / ▼ counts sit top left, read-only
 *   YOUR SET         the athlete's answer
 *   SAMPLE SET     after submitting, hidden until the athlete asks for it (SHOW SAMPLE SET),
 *                    so they can think it over first; then it ends with "how close were you?",
 *                    the athlete's grade of their own set (it shows their weak spots)
 *   PREVIOUS SETS    the athlete's earlier answers to it, once the sample set is shown
 *   FINISH / NEXT    after submitting
 * Rating the exercise sits on the exercise, grading yourself on the sample set. Add further
 * parts of solving an exercise as their own cards, in the place they're used.
 *
 * The optional callbacks add the training buttons: FINISH / NEXT EXERCISE after submitting
 * (SWAP and ← PREVIOUS are the workout's, above the rack). For a curator, on an exercise still to verify: REVIEW beside
 * SUBMIT (`onReview`: the sample set without a set), and under the open sample set the
 * CuratorCheck strip, ✓ VERIFY (then `onVerified`, e.g. on to the next) and ✎ FIX. Render with key={question.id} so a new exercise starts empty;
 * `initialAnswer`/`initialResult` resume one the athlete left (with `onDraftChange` to keep
 * the draft).
 */
export function ExerciseRack({
  question,
  previousSets = [],
  initialAnswer = "",
  initialResult = null,
  onDraftChange,
  submitLabel = "SUBMIT SET",
  feedback = false,
  canEdit = false,
  onSubmit,
  onReview,
  onVerified,
  onNext,
  onFinish,
}: {
  question: RackQuestion;
  /** The submit button's text, e.g. "SIGN IN TO SUBMIT" for a visitor. */
  submitLabel?: string;
  /** Whether the athlete may vote and leave feedback: signed in. */
  feedback?: boolean;
  /** Whether the athlete may edit the exercise (staff): EDIT on THE EXERCISE, back here after. */
  canEdit?: boolean;
  /** The athlete's earlier answers to this exercise, newest first (none for a visitor). */
  previousSets?: Answer[];
  /** A draft to resume. */
  initialAnswer?: string;
  /** The outcome of a set already submitted, to resume after it. */
  initialResult?: SubmitResult | null;
  /** Called on every edit of the answer, so the draft can be kept. */
  onDraftChange?: (answer: string) => void;
  /** Hands in the athlete's answer; resolves with the sample set to reveal. */
  onSubmit: (answer: string) => Promise<SubmitResult>;
  /** REVIEW (curators): resolves with the sample set, opened at once, without saving a set. */
  onReview?: () => Promise<SubmitResult>;
  /** After ✓ VERIFY: what comes next, e.g. the next exercise. Without it, no strip. */
  onVerified?: () => void;
  onNext?: () => void;
  onFinish?: () => void;
}) {
  const [answer, setAnswerState] = useState(initialAnswer);
  const [result, setResult] = useState<SubmitResult | null>(initialResult);
  const setAnswer = (value: string) => {
    setAnswerState(value);
    onDraftChange?.(value);
  };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Hidden again on resume (one click brings it back), except after REVIEW: that was the point.
  const [revealed, setRevealed] = useState(
    initialResult !== null && initialResult.answerId === null,
  );

  // The set's self-assessment: how close it came (on the sample set) and how the exercise felt
  // (on the exercise). The API replaces both values at once, so they're kept here together and
  // every save sends both.
  const assessAnswer = useAssessAnswer();
  const [selfGrade, setSelfGrade] = useState<number | null>(null);
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<number | null>(null);
  const [savedRows, setSavedRows] = useState<AssessmentRow[]>([]);
  const answerId = result?.answerId ?? null;
  const editLink = canEdit && (
    <Link
      to="/coach/exercises/$questionId"
      params={{ questionId: String(question.id) }}
      search={{ from: "train" }}
      className="text-[11px] font-semibold text-blue underline decoration-blue/40 underline-offset-2 hover:decoration-blue"
      title="Fix it in Coach's Corner (and verify it, if you coach its muscle), then come back to this workout"
    >
      edit exercise
    </Link>
  );

  const assess = (row: AssessmentRow, grade: number | null, difficulty: number | null) => {
    if (answerId === null) return;
    setSelfGrade(grade);
    setPerceivedDifficulty(difficulty);
    setSavedRows((rows) => rows.filter((r) => r !== row));
    assessAnswer.mutate(
      {
        answerId,
        assessment: {
          ...(grade !== null && { selfGrade: grade }),
          ...(difficulty !== null && { perceivedDifficulty: difficulty }),
        },
      },
      { onSuccess: () => setSavedRows((rows) => (rows.includes(row) ? rows : [...rows, row])) },
    );
  };
  // Clicking the chosen plate again clears it.
  const pickGrade = (plate: number) =>
    assess("form", plate === selfGrade ? null : plate, perceivedDifficulty);
  const pickDifficulty = (plate: number) =>
    assess("felt", selfGrade, plate === perceivedDifficulty ? null : plate);

  const submit = () => {
    setSubmitting(true);
    setError(null);
    onSubmit(answer)
      .then(setResult, setError)
      .finally(() => setSubmitting(false));
  };

  const review = onReview
    ? () => {
        setSubmitting(true);
        setError(null);
        onReview()
          .then((reviewed) => {
            setResult(reviewed);
            setRevealed(true);
          }, setError)
          .finally(() => setSubmitting(false));
      }
    : undefined;

  // Once saved, the new answer shows up among the previous sets too; it's the current one here.
  const earlierSets = previousSets.filter((set) => set.id !== result?.answerId);

  return (
    <div className="grid min-w-0 gap-6">
      {feedback ? (
        <ExerciseFeedback
          question={question}
          earlierSets={earlierSets}
          perceivedDifficulty={perceivedDifficulty}
          onPickDifficulty={pickDifficulty}
          canRateDifficulty={answerId !== null}
          difficultySaved={savedRows.includes("felt")}
          assessError={assessAnswer.error}
          action={editLink}
        />
      ) : (
        <ExerciseCard
          question={question}
          earlierSets={earlierSets}
          footer={<VisitorVotes up={question.upVotes} down={question.downVotes} />}
          action={editLink}
        />
      )}
      <SetCard
        answer={answer}
        onChange={setAnswer}
        submitted={result !== null}
        reviewed={result !== null && answerId === null}
        submitting={submitting}
        error={error}
        onSubmit={submit}
        submitLabel={submitLabel}
        onReview={review}
        snippet={codeBlocksOf(question.requirement)[0]}
      />
      {result && (
        <ModelAnswerCard
          sampleSolution={result.sampleSolution}
          source={result.source}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          footer={
            answerId !== null && (
              <>
                <PlatePicker
                  label="HOW CLOSE WERE YOU?"
                  value={selfGrade}
                  onChange={pickGrade}
                  colorOf={gradeColor}
                  lowLabel="poor form"
                  highLabel="nailed it"
                  status={<SavedMark saved={savedRows.includes("form")} />}
                  {...(selfGrade === null
                    ? { hint: "grade your own set: it shows your weak spots" }
                    : { valueLabel: `${selfGradeLabel(selfGrade)} · ${selfGrade}/10` })}
                />
                <ErrorMessage error={assessAnswer.error} />
              </>
            )
          }
        />
      )}
      {revealed && onVerified && question.canVerify && !question.verified && (
        <CuratorCheck
          questionId={question.id}
          canEdit={canEdit}
          // After a real set, stay: the athlete may still grade it, and moves on with NEXT.
          onVerified={answerId === null ? onVerified : undefined}
        />
      )}
      {revealed && earlierSets.length > 0 && <PreviousSetsCard sets={earlierSets} />}
      {result && (onFinish || onNext) && (
        <div className="flex flex-wrap gap-3">
          {onNext && <Button onClick={onNext}>NEXT EXERCISE →</Button>}
          {onFinish && (
            <Button variant="paper" onClick={onFinish}>
              FINISH
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A set done earlier, read-only, laid out like the rack after submitting: the exercise as it read
 * when answered, the athlete's answer, and the sample set behind a click. Render with
 * key={set.id} so the sample set closes again for another set.
 */
export function SetReview({ set }: { set: Answer }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="grid min-w-0 gap-6">
      <ExerciseCard question={set.question} earlierSets={[]} />
      <SetCard
        answer={set.answer}
        onChange={() => {}}
        submitted
        reviewed={false}
        submitting={false}
        error={null}
        onSubmit={() => {}}
        submitLabel=""
        snippet={undefined}
      />
      <ModelAnswerCard
        sampleSolution={set.question.sampleSolution}
        source={set.question.source}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />
    </div>
  );
}

/**
 * THE EXERCISE card; the set review reuses it. `action` goes after the heading (edit exercise,
 * in reviewer mode); `footer` closes the card: the votes (and the athlete's rating), in the same
 * place for members and visitors.
 */
export function ExerciseCard({
  question,
  earlierSets,
  action,
  footer,
}: {
  question: RackQuestion;
  earlierSets: Answer[];
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const lastSet = earlierSets[0];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-display text-[9px] text-ink/70">THE EXERCISE</p>
          {question.verified && (
            <Badge color="pixel">
              <span title="Verified: checked by a reviewer for a clear question and a correct answer">
                ✓ VERIFIED
              </span>
            </Badge>
          )}
          {action}
        </div>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-faded">
          <LoadMeter load={question.difficultyScore} /> load {question.difficultyScore}/10
        </span>
      </div>
      <h2 className="mt-3 text-lg leading-snug font-bold">{question.title}</h2>

      {/* Tags in the body font: the pixel font is unreadable this small. */}
      <p className="mt-3 flex flex-wrap gap-2">
        {question.conceptTags.map((tag) => (
          <span
            key={tag}
            className="border-2 border-ink/20 bg-muted px-2 py-0.5 text-[11px] font-semibold text-ink/70"
          >
            #{tag}
          </span>
        ))}
      </p>
      {lastSet && (
        <p className="mt-3 text-[11px] font-semibold text-faded">
          // you've done this one {earlierSets.length === 1 ? "once" : `${earlierSets.length}×`},
          last on {shortDate(lastSet.answeredAt)}. your previous sets show up with the sample set.
        </p>
      )}

      <RichText
        text={question.requirement}
        className="mt-5 border-t-2 border-dashed border-ink/15 pt-5"
      />
      {footer && <div className="mt-5 border-t-2 border-dashed border-ink/15 pt-1">{footer}</div>}
    </Card>
  );
}

/** A vote button, which is also its count: green when it's the athlete's ▲, amber for their ▼. */
function voteButtonClass(option: Vote, chosen: boolean) {
  return `border-2 border-line px-2.5 py-1 text-[11px] font-semibold transition hover:-translate-y-0.5 disabled:opacity-50 ${
    !chosen
      ? "bg-card hover:bg-muted"
      : option === "UP"
        ? "bg-pixel text-paper"
        : "bg-amber text-on-amber"
  }`;
}

/**
 * The votes as a visitor sees them: the same buttons and counts members see, in the same place
 * (the bottom of THE EXERCISE). Voting needs an account: a click signs in, and the workout, draft
 * included, carries on afterwards. Nothing when the counts are unknown.
 */
function VisitorVotes({ up, down }: { up: number | undefined; down: number | undefined }) {
  if (up === undefined || down === undefined) return null;
  const vote = (option: Vote, count: number) => (
    <button
      type="button"
      onClick={() => signInAndReturnTo("/train")}
      title="Sign in with GitHub to vote"
      className={voteButtonClass(option, false)}
    >
      {option === "UP" ? "▲ GOOD ONE" : "▼ NOT GREAT"} · {count}
    </button>
  );
  return (
    <>
      <span
        className="mt-4 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Votes on this exercise"
      >
        {vote("UP", up)}
        {vote("DOWN", down)}
      </span>
      <p className="mt-2 text-[11px] text-faded">
        // sign in to vote and leave a note to its coach
      </p>
    </>
  );
}

/** "Sep 12": when a set was done. */
function shortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/**
 * The athlete's earlier answers to this exercise, newest first, to compare with today's set:
 * the latest one open, older ones folded.
 */
function PreviousSetsCard({ sets }: { sets: Answer[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xs">YOUR PREVIOUS SETS</h2>
        <Badge color="muted">{sets.length}</Badge>
      </div>

      <div className="mt-4 divide-y-2 divide-dashed divide-ink/15">
        {sets.map((set, index) => (
          <details key={set.id} open={index === 0} className="py-3 first:pt-0 last:pb-0">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-faded hover:text-ink">
              <span className="text-ink">{shortDate(set.answeredAt)}</span>
              {set.selfGrade !== null && (
                <span className="inline-flex items-center gap-2">
                  <LoadMeter load={set.selfGrade} colorOf={gradeColor} />
                  {selfGradeLabel(set.selfGrade)}
                </span>
              )}
              {set.perceivedDifficulty !== null && (
                <span>felt like {set.perceivedDifficulty}/10</span>
              )}
            </summary>
            {/* As typed: athletes write plain text, so it's shown without code or bold styling. */}
            <p className="mt-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
              {set.answer}
            </p>
          </details>
        ))}
      </div>
    </Card>
  );
}

function SetCard({
  answer,
  onChange,
  submitted,
  reviewed,
  submitting,
  error,
  onSubmit,
  submitLabel,
  onReview,
  snippet,
}: {
  answer: string;
  onChange: (answer: string) => void;
  submitted: boolean;
  /** Opened with REVIEW: no set was logged. */
  reviewed: boolean;
  submitting: boolean;
  error: Error | null;
  onSubmit: () => void;
  submitLabel: string;
  /** REVIEW (curators): the sample set without answering. */
  onReview?: () => void;
  /** The exercise's code, if it has any: the athlete can start their answer from it. */
  snippet: string | undefined;
}) {
  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Card>
      <form onSubmit={onFormSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xs">YOUR SET</h2>
          {snippet && !submitted && !answer.includes(snippet) && (
            <button
              type="button"
              onClick={() => onChange(answer.trim() ? `${answer}\n\n${snippet}` : snippet)}
              title="Copies the exercise's code into your answer, to fix or annotate"
              className="border-2 border-line px-2 py-0.5 text-[10px] font-semibold hover:bg-muted"
            >
              start from the snippet
            </button>
          )}
        </div>

        <textarea
          aria-label="Your answer"
          maxLength={10000}
          required
          value={answer}
          readOnly={submitted || submitting}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => indentOnTab(event, onChange)}
          spellCheck={false}
          // Grows with its content (field-sizing, where the browser supports it), so code answers
          // fit without scrolling or resizing: tall while writing, shorter once submitted.
          className={`mt-4 w-full resize-y [field-sizing:content] ${fieldFrameClass} px-4 py-3 text-xs leading-relaxed text-ink outline-none placeholder:text-ink/35 read-only:opacity-70 ${
            submitted ? "min-h-64" : "min-h-[max(60vh,24rem)]"
          }`}
          placeholder="// your answer: words, code, pseudo-code. every rep counts."
        />

        <ErrorMessage error={error} />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          {reviewed ? (
            <p role="status" className="text-xs font-semibold text-faded">
              // reviewed: no set logged
            </p>
          ) : submitted ? (
            <p role="status" className="text-xs font-semibold text-pixel">
              ✓ set complete
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="pixel" disabled={answer.trim() === "" || submitting}>
                {submitting ? "LIFTING..." : submitLabel}
              </Button>
              {onReview && (
                <Button
                  type="button"
                  variant="paper"
                  onClick={onReview}
                  disabled={submitting}
                  title="Read the sample set without answering, to check the exercise: no set is logged"
                >
                  REVIEW
                </Button>
              )}
            </div>
          )}
          <span className="text-[11px] text-faded">
            {answer.length} chars · tab indents · esc, tab to move on
          </span>
        </div>
      </form>
    </Card>
  );
}

/**
 * The sample set under the athlete's set: closed until they ask for it. `footer` closes the
 * open card: on the rack, "how close were you?".
 */
export function ModelAnswerCard({
  sampleSolution,
  source,
  revealed,
  onReveal,
  footer,
}: {
  sampleSolution: string;
  source: string | null;
  revealed: boolean;
  onReveal: () => void;
  footer?: ReactNode;
}) {
  if (!revealed) {
    return (
      // Closed: the button takes the heading's place.
      <Card>
        <Button variant="pixel" onClick={onReveal}>
          SHOW SAMPLE SET
        </Button>
        <p className="mt-3 text-[11px] text-faded">
          // set logged. think it over first: what did you miss? then peek.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xs">SAMPLE SET</h2>
        <Badge color="pixel">COACH</Badge>
      </div>
      <p className="mt-2 text-[11px] text-faded">
        // one coach's take: check it against the sources before you rely on it.
      </p>
      <RichText text={sampleSolution} className="mt-4" />
      {source && (
        // The next step after seeing what you missed: where to read up on it.
        <p className="mt-4 border-l-4 border-pixel bg-muted px-3 py-2 text-xs leading-relaxed text-ink/80">
          <span className="mr-2 font-display text-[9px] text-pixel">READ MORE</span>
          {withLinks(source)}
        </p>
      )}
      {footer && <div className="border-t-2 border-dashed border-ink/15 pt-1">{footer}</div>}
    </Card>
  );
}

/**
 * Under the sample set, for whoever verifies the exercise: is it checked? ✓ VERIFY marks it
 * verified (a clear question, a correct answer), then `onVerified` (on to the next, after a
 * REVIEW). Without it (after a real set, which stays on screen to be graded), the strip just says
 * it's verified. ✎ FIX opens the edit screen (for whoever may edit it), which comes back to the
 * workout after.
 */
function CuratorCheck({
  questionId,
  canEdit,
  onVerified,
}: {
  questionId: number;
  canEdit: boolean;
  onVerified?: () => void;
}) {
  const verifyExercise = useVerifyExercise();
  if (verifyExercise.isSuccess && !onVerified) {
    return (
      <Card className="border-blue">
        <p role="status" className="text-xs font-semibold text-pixel">
          ✓ verified · your set stays logged; NEXT EXERCISE when you're done
        </p>
      </Card>
    );
  }
  return (
    <Card className="border-blue">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-2 font-display text-xs">CHECKED IT?</h2>
        <Button
          variant="pixel"
          disabled={verifyExercise.isPending}
          onClick={() =>
            verifyExercise.mutate({ questionId, verified: true }, { onSuccess: onVerified })
          }
          title={
            onVerified
              ? "A clear question and a correct answer: verified, and on to the next"
              : "A clear question and a correct answer: verified"
          }
        >
          ✓ VERIFY
        </Button>
        {canEdit && (
          <Link
            to="/coach/exercises/$questionId"
            params={{ questionId: String(questionId) }}
            search={{ from: "train" }}
            className={buttonClass("paper")}
            title="Fix it first, then save and verify: back to this workout after"
          >
            ✎ FIX
          </Link>
        )}
      </div>
      <ErrorMessage error={verifyExercise.error} />
    </Card>
  );
}

/** A green "✓ SAVED" once a value is stored; it stays until the value changes again. */
function SavedMark({ saved }: { saved: boolean }): ReactNode {
  return (
    saved && (
      <span
        role="status"
        className="border-2 border-pixel px-1.5 py-0.5 font-display text-[8px] leading-none text-pixel"
      >
        ✓ SAVED
      </span>
    )
  );
}

/**
 * THE EXERCISE card as an athlete rates it, from the start (no need to submit first). It all sits
 * at the bottom of the card, under the exercise, so rating needs no scrolling back up:
 *   - FELT LIKE next to the coach's load: saved with the athlete's set, so it opens once the set is
 *     submitted
 *   - under it, the vote buttons with their counts: ▲ GOOD ONE · n, ▼ NOT GREAT · n, the athlete's
 *     own highlighted. Clicking the chosen one again takes it back. Up votes make an exercise come
 *     up a bit more often.
 *   - a note to its coach, right under the votes: either vote opens it ("what makes it a good
 *     one?" / "what's off?"), taking the vote back closes it. Sent feedback stays open, with EDIT
 *     and WITHDRAW (CANCEL backs out of an edit), until its coach decides it; three open problems
 *     take an exercise out of workouts until then.
 */
function ExerciseFeedback({
  question,
  earlierSets,
  perceivedDifficulty,
  onPickDifficulty,
  canRateDifficulty,
  difficultySaved,
  assessError,
  action,
}: {
  question: RackQuestion;
  earlierSets: Answer[];
  perceivedDifficulty: number | null;
  onPickDifficulty: (plate: number) => void;
  /** Whether the set exists, so how it felt can be saved with it. */
  canRateDifficulty: boolean;
  difficultySaved: boolean;
  assessError: Error | null;
  /** Goes after the card's heading (EDIT, for staff). */
  action?: ReactNode;
}) {
  const questionId = question.id;
  const voteOnExercise = useVoteOnExercise();
  const reportExercise = useReportExercise();
  const { data: myFeedback } = useMyFeedback(questionId);
  const updateMyFeedback = useUpdateMyFeedback();
  const withdrawMyFeedback = useWithdrawMyFeedback();
  const initialVote = question.myVote ?? null;
  const [vote, setVote] = useState<Vote | null>(initialVote);
  // The note form: opened by ▼, by "+ say why" after ▲, or by EDIT on open feedback.
  const [writing, setWriting] = useState(false);
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState("");
  const [feedbackDone, setFeedbackDone] = useState<string | null>(null);

  // The counts as loaded, with the athlete's vote moved to where it is now.
  const count = (option: Vote, loaded: number | undefined) =>
    (loaded ?? 0) - (initialVote === option ? 1 : 0) + (vote === option ? 1 : 0);

  // Clicking the chosen vote again takes it back. A vote opens the note: why?
  const toggleVote = (clicked: Vote) => {
    const next = vote === clicked ? null : clicked;
    setFeedbackDone(null);
    voteOnExercise.mutate(
      { questionId, vote: next },
      {
        onSuccess: () => {
          setVote(next);
          if (myFeedback === null && !changing) setWriting(next !== null);
        },
      },
    );
  };

  // The vote decides what a new note is: ▲ praise, ▼ a problem ("not great"). Changing open
  // feedback keeps its kind.
  const reason: ReportReason | null = changing
    ? (myFeedback?.reason ?? null)
    : vote === "UP"
      ? "PRAISE"
      : vote === "DOWN"
        ? "OTHER"
        : null;
  const praise = reason === "PRAISE";

  const startChanging = () => {
    setNote(myFeedback?.note ?? "");
    setFeedbackDone(null);
    setChanging(true);
    setWriting(true);
  };

  const closeForm = () => {
    setWriting(false);
    setChanging(false);
    setNote("");
  };

  const sendFeedback = (event: FormEvent) => {
    event.preventDefault();
    if (!reason) return;
    const feedback = { questionId, reason, ...(note.trim() && { note: note.trim() }) };
    const done = (message: string) => () => {
      closeForm();
      setFeedbackDone(message);
    };
    if (changing) {
      updateMyFeedback.mutate(feedback, { onSuccess: done("✓ changed") });
    } else {
      reportExercise.mutate(feedback, {
        onSuccess: done("✓ sent. thanks: its coach will read it."),
      });
    }
  };

  const withdrawFeedback = () =>
    withdrawMyFeedback.mutate(questionId, {
      onSuccess: () => setFeedbackDone("✓ withdrawn. you can leave a new note any time."),
    });

  const feedbackPending =
    reportExercise.isPending || updateMyFeedback.isPending || withdrawMyFeedback.isPending;
  const feedbackError = reportExercise.error ?? updateMyFeedback.error ?? withdrawMyFeedback.error;

  const voteButton = (option: Vote, loaded: number | undefined) => (
    <button
      type="button"
      aria-pressed={vote === option}
      disabled={voteOnExercise.isPending}
      onClick={() => toggleVote(option)}
      title={option === "UP" ? "A good one" : "Not great"}
      className={voteButtonClass(option, vote === option)}
    >
      {option === "UP" ? "▲ GOOD ONE" : "▼ NOT GREAT"} · {count(option, loaded)}
    </button>
  );

  // Under the vote buttons: the note it opens, the athlete's open note, or a link to write one.
  const showNote = writing || myFeedback || reason || feedbackDone || voteOnExercise.error;
  const noteSection = showNote && (
    <>
      <ErrorMessage error={voteOnExercise.error} />
      {writing && reason ? (
        <form onSubmit={sendFeedback}>
          <p className="font-display text-[9px] text-ink/70">
            {praise ? "WHAT MAKES IT A GOOD ONE?" : "WHAT'S OFF?"}
            <span className="ml-2 font-body text-[10px] text-faded">
              a note to its coach, optional
            </span>
          </p>
          <textarea
            aria-label="Note to the coach"
            maxLength={2000}
            value={note}
            autoFocus
            onChange={(event) => setNote(event.target.value)}
            className={`mt-3 h-24 w-full resize-y ${fieldFrameClass} px-3 py-2 text-xs leading-relaxed text-ink outline-none placeholder:text-ink/35`}
            placeholder={
              praise
                ? "// what you like about it"
                : "// wrong, unclear, a duplicate? say what it should read instead"
            }
          />
          <ErrorMessage error={feedbackError} />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="submit" variant="paper" disabled={feedbackPending}>
              {changing ? "SAVE CHANGES" : "SEND"}
            </Button>
            {changing && (
              <Button type="button" variant="paper" onClick={closeForm}>
                CANCEL
              </Button>
            )}
          </div>
        </form>
      ) : myFeedback ? (
        // Their open feedback: still theirs to change or withdraw until its coach decides it.
        <div>
          <p className="flex flex-wrap items-center gap-2 font-display text-[9px] text-ink/70">
            YOUR NOTE
            <span
              className={`border-2 border-line px-2 py-0.5 font-body text-[11px] font-semibold ${
                myFeedback.reason === "PRAISE" ? "bg-pixel text-paper" : "bg-amber text-on-amber"
              }`}
            >
              {reportReasonLabels[myFeedback.reason]}
            </span>
            <span className="font-body text-[10px] text-faded">
              open: its coach hasn't decided it yet
            </span>
          </p>
          {myFeedback.note && (
            <p className="mt-3 border-l-2 border-ink/30 pl-3 text-xs break-words whitespace-pre-wrap text-ink/80">
              {myFeedback.note}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="paper"
              disabled={feedbackPending}
              onClick={startChanging}
            >
              EDIT
            </Button>
            <Button
              type="button"
              variant="paper"
              disabled={feedbackPending}
              onClick={withdrawFeedback}
            >
              WITHDRAW
            </Button>
          </div>
          <ErrorMessage error={feedbackError} />
        </div>
      ) : (
        reason && (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="text-[11px] font-semibold text-blue underline decoration-blue/40 underline-offset-2 hover:decoration-blue"
          >
            {praise ? "+ say why it's a good one" : "+ note to the coach: what's off?"}
          </button>
        )
      )}
      {feedbackDone && (
        <p role="status" className="mt-3 text-xs font-semibold text-pixel">
          {feedbackDone}
        </p>
      )}
    </>
  );

  const footer = (
    <>
      <PlatePicker
        label="FELT LIKE"
        value={perceivedDifficulty}
        onChange={onPickDifficulty}
        lowLabel="warm-up"
        highLabel="max effort"
        status={<SavedMark saved={difficultySaved} />}
        disabled={!canRateDifficulty}
        {...(!canRateDifficulty && { hint: "rate it after your set" })}
      />
      <ErrorMessage error={assessError} />
      <span
        className="mt-5 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Your vote on this exercise"
      >
        {voteButton("UP", question.upVotes)}
        {voteButton("DOWN", question.downVotes)}
      </span>
      {noteSection && <div className="mt-4">{noteSection}</div>}
    </>
  );

  return (
    <ExerciseCard question={question} earlierSets={earlierSets} action={action} footer={footer} />
  );
}

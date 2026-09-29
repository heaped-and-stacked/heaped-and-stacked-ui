import { useState, type FormEvent, type ReactNode } from "react";
import {
  useAssessAnswer,
  useMyFeedback,
  useReportExercise,
  useUpdateMyFeedback,
  useVoteOnExercise,
  useWithdrawMyFeedback,
} from "@/api/queries";
import type { Answer, LearningQuestion, ReportReason, Vote } from "@/api/types";
import { gradeColor, LoadMeter, PlatePicker } from "@/components/LoadMeter";
import {
  Badge,
  Button,
  Card,
  codeBlocksOf,
  ErrorMessage,
  fieldFrameClass,
  indentOnTab,
  RichText,
} from "@/components/ui";
import { reportReasonLabels, selfGradeLabel } from "@/labels";

/** What the rack shows of an exercise before it's answered: never the model answer. */
export type RackQuestion = Pick<
  LearningQuestion,
  "id" | "title" | "requirement" | "difficultyScore" | "conceptTags"
> &
  Partial<Pick<LearningQuestion, "upVotes" | "downVotes" | "myVote">>;

/** What comes back once a set is submitted. No answerId means nothing was saved (a preview). */
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
 *   THE EXERCISE     what to do. Its ▲ / ▼ counts sit top left; with `feedback` on (signed in,
 *                    not an author preview) they're the athlete's vote, and the card ends with
 *                    how the exercise felt and a note to its coach (ExerciseFeedback)
 *   YOUR SET         the athlete's answer
 *   MODEL ANSWER     after submitting, hidden until the athlete asks for it (SHOW MODEL ANSWER),
 *                    so they can think it over first; then it ends with "how close were you?",
 *                    the athlete's grade of their own set (it shows their weak spots)
 *   PREVIOUS SETS    the athlete's earlier answers to it, once the model answer is shown
 *   FINISH / NEXT    after submitting
 * Rating the exercise sits on the exercise, grading yourself on the model answer. Add further
 * parts of solving an exercise as their own cards, in the place they're used.
 *
 * The optional callbacks add the training buttons: SWAP EXERCISE before submitting,
 * FINISH / NEXT EXERCISE after. Render with key={question.id} so a new exercise starts empty;
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
  onSubmit,
  onSwap,
  onNext,
  onFinish,
}: {
  question: RackQuestion;
  /** The submit button's text, e.g. "SIGN IN & SUBMIT" for a visitor. */
  submitLabel?: string;
  /** Whether the athlete may vote and leave feedback: signed in, and not an author preview. */
  feedback?: boolean;
  /** The athlete's earlier answers to this exercise, newest first (none in an author preview). */
  previousSets?: Answer[];
  /** A draft to resume. */
  initialAnswer?: string;
  /** The outcome of a set already submitted, to resume after it. */
  initialResult?: SubmitResult | null;
  /** Called on every edit of the answer, so the draft can be kept. */
  onDraftChange?: (answer: string) => void;
  /** Hands in the athlete's answer; resolves with the model answer to reveal. */
  onSubmit: (answer: string) => Promise<SubmitResult>;
  /** Skip this exercise for another one, without submitting. */
  onSwap?: () => void;
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
  // Hidden again on resume: one click brings it back.
  const [revealed, setRevealed] = useState(false);

  // The set's self-assessment: how close it came (on the model answer) and how the exercise felt
  // (on the exercise). The API replaces both values at once, so they're kept here together and
  // every save sends both.
  const assessAnswer = useAssessAnswer();
  const [selfGrade, setSelfGrade] = useState<number | null>(null);
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<number | null>(null);
  const [savedRows, setSavedRows] = useState<AssessmentRow[]>([]);
  const answerId = result?.answerId ?? null;

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
        />
      ) : (
        <ExerciseCard
          question={question}
          earlierSets={earlierSets}
          aside={<VoteCounts up={question.upVotes} down={question.downVotes} />}
        />
      )}
      <SetCard
        answer={answer}
        onChange={setAnswer}
        submitted={result !== null}
        submitting={submitting}
        error={error}
        onSubmit={submit}
        submitLabel={submitLabel}
        onSwap={onSwap}
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
 * when answered, the athlete's answer, and the model answer behind a click. Render with
 * key={set.id} so the model answer closes again for another set.
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
        submitting={false}
        error={null}
        onSubmit={() => {}}
        submitLabel=""
        onSwap={undefined}
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
 * THE EXERCISE card; the exercise page in Coach's Corner reuses it. `aside` goes top left, before
 * its heading (the vote buttons), `note` right under it (the note they open); `footer` closes the card (the athlete's rating of it).
 */
export function ExerciseCard({
  question,
  earlierSets,
  aside,
  note,
  footer,
}: {
  question: RackQuestion;
  earlierSets: Answer[];
  aside?: ReactNode;
  note?: ReactNode;
  footer?: ReactNode;
}) {
  const lastSet = earlierSets[0];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {aside}
          <p className="font-display text-[9px] text-ink/70">THE EXERCISE</p>
        </div>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-faded">
          <LoadMeter load={question.difficultyScore} /> load {question.difficultyScore}/10
        </span>
      </div>
      {note && <div className="mt-4 border-b-2 border-dashed border-ink/15 pb-4">{note}</div>}
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
          last on {shortDate(lastSet.answeredAt)}. your previous sets show up with the model answer.
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

/** How athletes rate an exercise, read-only: ▲ up votes, ▼ down votes. Nothing when unknown. */
function VoteCounts({ up, down }: { up: number | undefined; down: number | undefined }) {
  if (up === undefined || down === undefined) return null;
  return (
    <span
      className="text-[11px] font-semibold text-faded"
      title="How athletes rate it: ▲ a good one, ▼ not great"
    >
      <span className="text-pixel">▲ {up}</span> <span className="text-amber-ink">▼ {down}</span>
    </span>
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
  submitting,
  error,
  onSubmit,
  submitLabel,
  onSwap,
  snippet,
}: {
  answer: string;
  onChange: (answer: string) => void;
  submitted: boolean;
  submitting: boolean;
  error: Error | null;
  onSubmit: () => void;
  submitLabel: string;
  onSwap: (() => void) | undefined;
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
          {submitted ? (
            <p role="status" className="text-xs font-semibold text-pixel">
              ✓ set complete
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="pixel" disabled={answer.trim() === "" || submitting}>
                {submitting ? "LIFTING..." : submitLabel}
              </Button>
              {onSwap && (
                <Button type="button" variant="paper" onClick={onSwap} disabled={submitting}>
                  SWAP EXERCISE
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
 * The model answer under the athlete's set: closed until they ask for it. `footer` closes the
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
          SHOW MODEL ANSWER
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
        <h2 className="font-display text-xs">MODEL ANSWER</h2>
        <Badge color="pixel">SPOTTER</Badge>
      </div>
      <RichText text={sampleSolution} className="mt-4" />
      {source && <p className="mt-4 text-[11px] font-semibold text-faded">source: {source}</p>}
      <p className="mt-4 border-t-2 border-dashed border-ink/15 pt-3 text-[11px] text-faded">
        // spotter's notes, not gospel: double-check before you rely on it.
      </p>
      {footer && <div className="border-t-2 border-dashed border-ink/15 pt-1">{footer}</div>}
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
 * THE EXERCISE card as an athlete rates it, from the start (no need to submit first):
 *   - top left, the vote buttons with their counts: ▲ GOOD ONE · n, ▼ NOT GREAT · n, the
 *     athlete's own highlighted. Clicking the chosen one again takes it back. Up votes make an
 *     exercise come up a bit more often.
 *   - at the bottom, FELT LIKE next to the coach's load: saved with the athlete's set, so it opens
 *     once the set is submitted
 *   - a note to its coach: either vote opens it ("what makes it a good one?" / "what's off?"),
 *     taking the vote back closes it. Sent feedback stays open, with EDIT and WITHDRAW (CANCEL
 *     backs out of an edit), until its coach decides it; three open problems take an exercise out of workouts
 *     until then.
 */
function ExerciseFeedback({
  question,
  earlierSets,
  perceivedDifficulty,
  onPickDifficulty,
  canRateDifficulty,
  difficultySaved,
  assessError,
}: {
  question: RackQuestion;
  earlierSets: Answer[];
  perceivedDifficulty: number | null;
  onPickDifficulty: (plate: number) => void;
  /** Whether the set exists, so how it felt can be saved with it. */
  canRateDifficulty: boolean;
  difficultySaved: boolean;
  assessError: Error | null;
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

  // A vote button that is also its count: green when it's the athlete's ▲, amber for their ▼.
  const voteButton = (option: Vote, loaded: number | undefined) => (
    <button
      type="button"
      aria-pressed={vote === option}
      disabled={voteOnExercise.isPending}
      onClick={() => toggleVote(option)}
      title={option === "UP" ? "A good one" : "Not great"}
      className={`border-2 border-line px-2.5 py-1 text-[11px] font-semibold transition hover:-translate-y-0.5 disabled:opacity-50 ${
        vote !== option
          ? "bg-card hover:bg-muted"
          : option === "UP"
            ? "bg-pixel text-paper"
            : "bg-amber text-on-amber"
      }`}
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
            className="text-[11px] font-semibold text-faded underline hover:text-ink"
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
    </>
  );

  return (
    <ExerciseCard
      question={question}
      earlierSets={earlierSets}
      aside={
        <span className="inline-flex gap-1.5" role="group" aria-label="Your vote on this exercise">
          {voteButton("UP", question.upVotes)}
          {voteButton("DOWN", question.downVotes)}
        </span>
      }
      note={noteSection}
      footer={footer}
    />
  );
}

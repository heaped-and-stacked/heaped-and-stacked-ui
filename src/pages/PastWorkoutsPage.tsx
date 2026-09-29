import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useConcepts, useMyAnswers } from "@/api/queries";
import type { Answer } from "@/api/types";
import { gradeColor, LoadMeter } from "@/components/LoadMeter";
import { RequireSignIn } from "@/components/RequireSignIn";
import {
  Button,
  buttonClass,
  Card,
  ErrorMessage,
  Loading,
  PAGE_SIZE,
  PageHeading,
  Pager,
  Stat,
} from "@/components/ui";
import { selfGradeLabel } from "@/labels";
import { useRetry } from "./rack/TrainPage";

/**
 * The athlete's history: what they trained, how it went, and which muscles they've worked the
 * most. About history, not streaks.
 */
export function PastWorkoutsPage() {
  return (
    <RequireSignIn area="past workouts">
      {() => (
        <>
          <PageHeading prompt="git log --author=me" title="PAST WORKOUTS">
            Every set you finish lands here: what you trained, how it went, and the muscles you've
            worked the most.
          </PageHeading>
          <div className="mt-12">
            <History />
          </div>
        </>
      )}
    </RequireSignIn>
  );
}

function History() {
  const { data: answers, isPending, error } = useMyAnswers();

  if (isPending) return <Loading what="reading the log book" />;
  if (error) return <ErrorMessage error={error} />;
  if (answers.length === 0) return <EmptyHistory />;

  const musclesWorked = new Set(answers.flatMap((answer) => answer.question.conceptTags)).size;

  return (
    // grid-cols-1, not a bare grid: the column then fits the screen instead of the widest content.
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <Stat value={answers.length} label="sets finished" color="text-pixel" />
        <Stat value={musclesWorked} label="muscles worked" color="text-amber-ink" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <MonthCalendar answers={answers} />
        <TopMuscles answers={answers} />
      </div>

      <RecentSets answers={answers} />
    </div>
  );
}

function EmptyHistory() {
  return (
    <figure className="py-6 text-center">
      <figcaption className="text-xs font-medium text-faded">
        // no sets logged yet. pick a muscle and your first rep starts the log book.
      </figcaption>
      <Link to="/" hash="muscle-map" className={`${buttonClass("ink")} mt-6`}>
        PICK A MUSCLE
      </Link>
    </figure>
  );
}

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * One month, Monday first, with the days the athlete trained filled in: the current one to start
 * with; ◀ / ▶ step back to the month of their first set and forward to this one.
 */
function MonthCalendar({ answers }: { answers: Answer[] }) {
  const today = new Date();
  // Months back from this one: 0 is this month.
  const [back, setBack] = useState(0);
  const shown = new Date(today.getFullYear(), today.getMonth() - back, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (shown.getDay() + 6) % 7;
  const monthName = shown.toLocaleString("en", { month: "long" }).toUpperCase();
  const isThisMonth = back === 0;

  // How far back there's anything to see: the month of the first set.
  const first = answers.reduce<Date | null>((earliest, answer) => {
    const date = new Date(answer.answeredAt);
    return earliest === null || date < earliest ? date : earliest;
  }, null);
  const furthestBack = first
    ? (today.getFullYear() - first.getFullYear()) * 12 + today.getMonth() - first.getMonth()
    : 0;

  const trainedDays = new Set(
    answers
      .map((answer) => new Date(answer.answeredAt))
      .filter((date) => date.getFullYear() === year && date.getMonth() === month)
      .map((date) => date.getDate()),
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xs">
          {monthName}_{year}
        </p>
        <div className="flex gap-2">
          <Button
            variant="paper"
            size="sm"
            disabled={back >= furthestBack}
            onClick={() => setBack(back + 1)}
            aria-label="The month before"
            title="The month before"
          >
            ◀
          </Button>
          <Button
            variant="paper"
            size="sm"
            disabled={isThisMonth}
            onClick={() => setBack(back - 1)}
            aria-label="The month after"
            title="The month after"
          >
            ▶
          </Button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-2">
        {weekdays.map((day, index) => (
          <span key={index} className="text-center font-display text-[8px] text-faded">
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const trained = trainedDays.has(day);
          const isToday = isThisMonth && day === today.getDate();
          return (
            <span
              key={day}
              className={`grid h-10 place-items-center border-2 text-[10px] font-semibold ${
                trained ? "border-line bg-pixel text-paper" : "border-ink/10 bg-paper text-faded"
              } ${isToday ? "border-line! text-ink" : ""}`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

const podiumColors = ["bg-pixel", "bg-amber", "bg-blush"];

/** The three muscles with the most sets, with a bar relative to the first. */
function TopMuscles({ answers }: { answers: Answer[] }) {
  const { data: concepts } = useConcepts();
  const nameOf = (tag: string) => concepts?.find((concept) => concept.tag === tag)?.name ?? tag;

  const setsPerMuscle = new Map<string, number>();
  for (const tag of answers.flatMap((answer) => answer.question.conceptTags)) {
    setsPerMuscle.set(tag, (setsPerMuscle.get(tag) ?? 0) + 1);
  }
  const top = [...setsPerMuscle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const most = top[0]?.[1] ?? 1;

  return (
    <Card>
      <p className="font-display text-xs">TOP MUSCLES</p>
      {/* grid-cols-1, not a bare grid: the column can then shrink, so long names truncate. */}
      <ol className="mt-6 grid grid-cols-1 gap-5">
        {top.map(([tag, sets], index) => (
          <li key={tag}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-bold">
                <span className="mr-2 font-display text-[10px] text-faded">{index + 1}.</span>
                {nameOf(tag)}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-faded">
                {sets} {sets === 1 ? "set" : "sets"}
              </span>
            </div>
            <div className="mt-2 h-3 border-2 border-line bg-paper">
              <div
                className={`h-full ${podiumColors[index]}`}
                style={{ width: `${(sets / most) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const setOrders = {
  newest: "newest",
  form: "poorest form",
  oldest: "longest ago",
} as const;

type SetOrder = keyof typeof setOrders;

/** Calendar days since a set (by the athlete's own clock), in words. */
function agoLabel(answeredAt: string): string {
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.max(
    0,
    Math.round((startOfDay(new Date()) - startOfDay(new Date(answeredAt))) / 86_400_000),
  );
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * The athlete's sets, each with its form and how long ago it was. Sorted by newest (every set),
 * or by poorest form or longest ago (each exercise once, by its latest set: that's what's worth
 * another go). ANOTHER SET starts a workout on that exercise's muscles with it first. Shown 20 at
 * a time.
 */
function RecentSets({ answers }: { answers: Answer[] }) {
  const retry = useRetry();
  const [order, setOrder] = useState<SetOrder>("newest");
  const [page, setPage] = useState(0);

  // Answers come newest first: the first set of an exercise is its latest.
  const latestPerExercise = answers.filter(
    (answer, index) =>
      answers.findIndex((other) => other.question.id === answer.question.id) === index,
  );
  const shown =
    order === "newest"
      ? answers
      : order === "form"
        ? // Ungraded sets last; the same form, the older first.
          [...latestPerExercise].sort(
            (a, b) =>
              (a.selfGrade ?? 11) - (b.selfGrade ?? 11) || a.answeredAt.localeCompare(b.answeredAt),
          )
        : [...latestPerExercise].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  // Every set is loaded already (the stats above need them all), so the pages are cut here.
  const totalPages = Math.ceil(shown.length / PAGE_SIZE);
  // A list that shrank under the page shows its new last page.
  const current = Math.min(page, Math.max(totalPages - 1, 0));
  const pageSets = shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xs">YOUR SETS</h2>
        <div className="flex gap-2" role="group" aria-label="Sort sets by">
          {(Object.keys(setOrders) as SetOrder[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={order === option}
              onClick={() => {
                if (option !== order) {
                  setOrder(option);
                  setPage(0);
                }
              }}
              className={`border-2 border-line px-2 py-1 text-[11px] font-semibold ${
                order === option ? "bg-blue-tint text-blue" : "bg-card hover:bg-muted"
              }`}
            >
              {setOrders[option]}
            </button>
          ))}
        </div>
      </div>
      <div className="pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-line bg-card">
        {pageSets.map((answer) => (
          <article key={answer.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:gap-5">
            <p className="shrink-0 text-[11px] font-semibold text-faded sm:w-20">
              {new Date(answer.answeredAt).toLocaleDateString("en", {
                month: "short",
                day: "numeric",
              })}
              <span className="block font-normal">{agoLabel(answer.answeredAt)}</span>
            </p>
            <div className="min-w-0 flex-1">
              {/* Sets saved before exercises had titles fall back to the exercise text. */}
              <p className="line-clamp-2 text-sm font-bold">
                {answer.question.title || answer.question.requirement}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-faded">
                <span>→ {answer.question.conceptTags.join(", ")}</span>
                {answer.selfGrade !== null ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadMeter load={answer.selfGrade} colorOf={gradeColor} />
                    {selfGradeLabel(answer.selfGrade)} · {answer.selfGrade}/10
                  </span>
                ) : (
                  <span className="font-normal">form not graded</span>
                )}
                {answer.perceivedDifficulty !== null && (
                  <span>felt {answer.perceivedDifficulty}/10</span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="paper"
                  size="sm"
                  onClick={() => retry(answer.question.id, answer.question.conceptTags)}
                  title="Train it again, then go on with its muscles"
                >
                  ANOTHER SET
                </Button>
                <Link
                  to="/workouts/$questionId"
                  params={{ questionId: String(answer.question.id) }}
                  search={{ set: answer.id }}
                  className={buttonClass("paper", "sm")}
                  title="Your answer as you sent it, the sample set, and your other sets of it"
                >
                  REVIEW
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Pager label="Pages of your sets" page={current} totalPages={totalPages} onPage={setPage} />
    </section>
  );
}

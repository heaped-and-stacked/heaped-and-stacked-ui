import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useConcepts, useCuratedQuestions } from "@/api/queries";
import type { Question } from "@/api/types";
import {
  Badge,
  Button,
  buttonClass,
  ErrorMessage,
  fieldFrameClass,
  Loading,
  PAGE_SIZE,
  Pager,
} from "@/components/ui";
import { useRetry } from "../rack/TrainPage";

/**
 * The exercises the user coaches, newest first, a page at a time: their own, and for staff every
 * one in the gym's pool. Filters by muscle (any of an exercise's, not only its main one) and by
 * part of the title. Each exercise shows its muscles (✓ where it's verified for one), athletes'
 * votes once there are any, TRY IT and EDIT. Benching and deleting are on the exercise's page.
 */
export function MyExercises({
  isStaff,
  muscle: startMuscle,
}: {
  isStaff: boolean;
  /** The muscle to filter on to start with (SEE ALL EXERCISES on a muscle's page). */
  muscle?: string;
}) {
  const [muscle, setMuscle] = useState(startMuscle ?? "");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { data: concepts } = useConcepts();
  const retry = useRetry();
  const {
    data: result,
    isPending,
    isPlaceholderData,
    error,
  } = useCuratedQuestions({
    concept: muscle || undefined,
    search: search || undefined,
    // Staff outside reviewer mode see what a member sees: their own.
    asMember: !isStaff,
    page,
    size: PAGE_SIZE,
  });
  const questions = result?.items;
  const filtered = muscle !== "" || search !== "";

  // Searches once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // When the list shrinks under the last page (an exercise deleted elsewhere), step back.
  useEffect(() => {
    if (result && result.totalPages > 0 && page >= result.totalPages) {
      setPage(result.totalPages - 1);
    }
  }, [result, page]);

  const muscles = [...(concepts ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="search titles…"
          aria-label="Search exercise titles"
          className={`${fieldFrameClass} w-64 px-3 py-2 text-xs text-ink outline-none placeholder:text-ink/35`}
        />
        <select
          value={muscle}
          onChange={(event) => {
            setMuscle(event.target.value);
            setPage(0);
          }}
          aria-label="Filter by muscle"
          className={`${fieldFrameClass} w-56 px-3 py-2 text-xs text-ink outline-none`}
        >
          <option value="">all muscles</option>
          {muscles.map((concept) => (
            <option key={concept.tag} value={concept.tag}>
              {concept.name}
            </option>
          ))}
        </select>
        {result && (
          <p className="text-xs font-semibold text-faded">
            <span className="text-ink">{result.totalItems}</span>{" "}
            {filtered ? "found" : isStaff ? "in the gym" : "coached"}
            {isStaff && " · benched exercises are out of every workout, answers kept"}
          </p>
        )}
      </div>

      <div
        className={`pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-line bg-card transition-opacity ${
          isPlaceholderData ? "opacity-60" : ""
        }`}
      >
        {isPending && (
          <div className="p-6">
            <Loading what="counting your reps" />
          </div>
        )}
        {error && (
          <div className="p-6">
            <ErrorMessage error={error} />
          </div>
        )}
        {questions?.length === 0 && (
          <p className="p-6 text-xs font-medium text-faded">
            {filtered
              ? "// nothing matches: try another muscle or fewer letters"
              : "// no reps logged yet: your first exercise goes here"}
          </p>
        )}

        {questions?.map((question) => {
          return (
            <article
              key={question.id}
              className={`flex flex-col gap-3 p-5 lg:flex-row lg:items-start ${
                question.status === "RETIRED" ? "bg-muted/40" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <Link
                  to="/coach/exercises/$questionId"
                  params={{ questionId: String(question.id) }}
                  search={{ from: "exercises" }}
                  className="block truncate text-sm font-bold hover:underline"
                  title="Open it: edit, verify, its feedback"
                >
                  {question.title}
                </Link>
                <p className="mt-1 line-clamp-1 text-xs text-ink/70">{question.requirement}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-faded">
                  <span>#{question.id}</span>
                  {question.status === "RETIRED" && <Badge color="muted">BENCHED</Badge>}
                  <span>load {question.difficultyScore}/10</span>
                  <MuscleChips question={question} />
                  {question.upVotes + question.downVotes > 0 && (
                    <span title="Athletes' votes on this exercise">
                      <span className="text-pixel">▲ {question.upVotes}</span>{" "}
                      <span className="text-danger">▼ {question.downVotes}</span>
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 self-start">
                <Button
                  variant="paper"
                  size="sm"
                  onClick={() => retry(question.id, question.conceptTags)}
                  title="Train it on the rack, as athletes do: a workout on its muscles, this one first"
                >
                  TRY IT
                </Button>
                <Link
                  to="/coach/exercises/$questionId"
                  params={{ questionId: String(question.id) }}
                  search={{ from: "exercises" }}
                  className={buttonClass("paper", "sm")}
                >
                  EDIT
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <Pager
        label="Pages of your exercises"
        page={page}
        totalPages={result?.totalPages ?? 0}
        onPage={setPage}
      />
    </section>
  );
}

/** An exercise's muscles as chips, then ✓ verified when it's been checked. */
export function MuscleChips({ question }: { question: Question }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {question.conceptTags.map((tag) => (
        <span key={tag} className="border border-ink/25 px-1.5 py-0.5 text-faded">
          #{tag}
        </span>
      ))}
      {question.verified && (
        <span className="text-pixel" title="Checked by a coach: a clear question, a correct answer">
          ✓ verified
        </span>
      )}
    </span>
  );
}

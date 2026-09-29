import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useConcepts,
  useCuratedQuestions,
  useDeleteQuestion,
  useUpdateQuestionStatus,
} from "@/api/queries";
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

const smallButton = "shrink-0 px-3 py-2 text-[9px]";

/**
 * The exercises the user coaches, newest first, a page at a time: their own, or everyone's for
 * staff. Filters by muscle (any of an exercise's, not only its main one) and by part of the
 * title. Each exercise shows athletes' votes once there are any, and what the user may do to it:
 * try it and edit it, bench it or bring it back (staff), delete it (staff, and only while nobody
 * has answered it; the API says so otherwise).
 */
export function MyExercises({ isStaff }: { isStaff: boolean }) {
  const [muscle, setMuscle] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { data: concepts } = useConcepts();
  const {
    data: result,
    isPending,
    isPlaceholderData,
    error,
  } = useCuratedQuestions({
    muscle: muscle || undefined,
    search: search || undefined,
    page,
    size: PAGE_SIZE,
  });
  const questions = result?.items;
  const filtered = muscle !== "" || search !== "";
  const updateStatus = useUpdateQuestionStatus();
  const deleteQuestion = useDeleteQuestion();
  const busy = updateStatus.isPending || deleteQuestion.isPending;

  // Searches once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // After a delete empties the last page, step back to the one before.
  useEffect(() => {
    if (result && result.totalPages > 0 && page >= result.totalPages) {
      setPage(result.totalPages - 1);
    }
  }, [result, page]);

  const confirmDelete = (question: Question) => {
    if (window.confirm(`Delete exercise #${question.id} for good? This can't be undone.`)) {
      deleteQuestion.mutate(question.id);
    }
  };

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

      <ErrorMessage error={updateStatus.error ?? deleteQuestion.error} />

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
                  className="block truncate text-sm font-bold hover:underline"
                  title="Its page: votes, all feedback, actions"
                >
                  {question.title}
                </Link>
                <p className="mt-1 line-clamp-1 text-xs text-ink/70">{question.requirement}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-faded">
                  <span>#{question.id}</span>
                  {question.status === "RETIRED" && <Badge color="muted">BENCHED</Badge>}
                  <span>load {question.difficultyScore}/10</span>
                  <span>→ {question.conceptTags.join(", ")}</span>
                  {question.upVotes + question.downVotes > 0 && (
                    <span title="Athletes' votes on this exercise">
                      <span className="text-pixel">▲ {question.upVotes}</span>{" "}
                      <span className="text-danger">▼ {question.downVotes}</span>
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 self-start">
                <Link
                  to="/rack/$questionId"
                  params={{ questionId: String(question.id) }}
                  className={`${buttonClass("paper")} ${smallButton}`}
                  title="See it on the exercise rack, as athletes will"
                >
                  TRY IT
                </Link>
                <Link
                  to="/coach"
                  search={{ tab: "exercise", edit: question.id }}
                  className={`${buttonClass("paper")} ${smallButton}`}
                >
                  EDIT
                </Link>
                {isStaff &&
                  (question.status === "RETIRED" ? (
                    <Button
                      variant="paper"
                      className={smallButton}
                      disabled={busy}
                      onClick={() => updateStatus.mutate({ id: question.id, status: "SUBMITTED" })}
                      title="Back into workouts"
                    >
                      UNBENCH
                    </Button>
                  ) : (
                    <Button
                      variant="paper"
                      className={smallButton}
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
                    className={smallButton}
                    disabled={busy}
                    onClick={() => confirmDelete(question)}
                    title="Only while nobody has answered it; otherwise bench it"
                  >
                    DELETE
                  </Button>
                )}
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

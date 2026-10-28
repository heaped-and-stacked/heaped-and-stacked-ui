import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useConcepts, useCurrentUser, useMyAnswers } from "@/api/queries";
import { type QuestionPool } from "@/api/types";
import { useReviewer } from "./ReviewerMode";
import { buttonClass, ErrorMessage, fieldFrameClass } from "./ui";

/**
 * The most chips the bar shows: picked muscles and suggestions. Further picked muscles fold into
 * "+N picked".
 */
const MAX_CHIPS = 6;

/**
 * The chips to show, keeping each chip where it was: picking or unpicking a chip in the bar only
 * changes its colour. A picked muscle not in the bar yet (picked from the + MUSCLES list) takes a
 * free slot, or replaces the last unpicked suggestion; with none left, it folds into "+N picked".
 * Free slots are filled with suggestions.
 */
function arrangeChips(previous: string[], picked: string[], suggestions: string[]): string[] {
  const known = new Set([...picked, ...suggestions]);
  const slots = previous.filter((tag) => known.has(tag));
  for (const tag of picked) {
    if (slots.includes(tag)) continue;
    if (slots.length < MAX_CHIPS) {
      slots.push(tag);
      continue;
    }
    const unpicked = slots.filter((slot) => !picked.includes(slot));
    const lastUnpicked = unpicked[unpicked.length - 1];
    if (lastUnpicked !== undefined) slots[slots.indexOf(lastUnpicked)] = tag;
  }
  for (const tag of suggestions) {
    if (slots.length >= MAX_CHIPS) break;
    if (!slots.includes(tag)) slots.push(tag);
  }
  return slots;
}

/**
 * The muscles picked for the next workout, shared by every page (the workout bar, the muscle
 * map, the rack). None picked = all muscles. Kept in localStorage so the pick survives a reload;
 * it's a convenience only, so a browser without storage just starts from "all muscles".
 */
const STORAGE_KEY = "hs.workout.muscles";
const listeners = new Set<() => void>();
let picked: string[] = readPicked();

function readPicked(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function setPicked(tags: string[]) {
  picked = tags;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
  } catch {
    // Not stored: the pick lasts until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorkoutMuscles() {
  const muscles = useSyncExternalStore(subscribe, () => picked);
  return {
    muscles,
    toggle: (tag: string) =>
      setPicked(muscles.includes(tag) ? muscles.filter((t) => t !== tag) : [...muscles, tag]),
    clear: () => setPicked([]),
    /** Picks exactly these muscles, e.g. those of an exercise retried from past workouts. */
    pickOnly: (tags: string[]) => setPicked(tags),
  };
}

/**
 * Which exercises a workout draws from (QuestionPool): in reviewer mode the ones still to verify,
 * that's what the mode is for; otherwise all of them, a ✓ VERIFIED mark on the checked ones.
 */
export function useWorkoutPool() {
  const { reviewing } = useReviewer();
  const pool: QuestionPool = reviewing ? "TO_VERIFY" : "ALL";
  return { pool, reviewing };
}

/**
 * A strip under the top bar: the one place to pick muscles for the next workout. It shows the
 * picked muscles as toggles, in the order they were picked, and fills the free slots with the
 * athlete's most trained muscles to pick from; + MUSCLES opens a filterable list of all of them.
 * In reviewer mode a TO VERIFY label says what it trains (useWorkoutPool). START TRAINING works from
 * anywhere, and with nothing picked it trains all muscles. Stays in view while scrolling, except
 * on phones, where it wraps to several rows and would cover too much of the screen.
 */
export function WorkoutBar() {
  const { data: concepts, error } = useConcepts();
  const { data: user } = useCurrentUser();
  // A visitor has no sets: muscles are simply in alphabetical order.
  const { data: answers } = useMyAnswers(!!user);
  const { muscles, toggle, clear } = useWorkoutMuscles();
  const { reviewing } = useWorkoutPool();
  const [pickerOpen, setPickerOpen] = useState(false);
  const onTrainPage = useRouterState({ select: (state) => state.location.pathname === "/train" });

  const active = concepts?.filter((concept) => concept.status === "ACTIVE") ?? [];
  // A picked muscle that was unpublished since is simply left out.
  const picked = muscles.filter((tag) => active.some((concept) => concept.tag === tag));

  // Suggestions: most trained first (sets done per muscle), then by name.
  const setsPerMuscle = new Map<string, number>();
  answers?.forEach((answer) =>
    answer.question.conceptTags.forEach((tag) =>
      setsPerMuscle.set(tag, (setsPerMuscle.get(tag) ?? 0) + 1),
    ),
  );
  const byTraining = [...active].sort(
    (a, b) =>
      (setsPerMuscle.get(b.tag) ?? 0) - (setsPerMuscle.get(a.tag) ?? 0) ||
      a.name.localeCompare(b.name),
  );
  // Chips keep their place once shown (arrangeChips); the first arrangement waits for the
  // athlete's sets, which decide the suggestions. Chips keep their full size: past MAX_CHIPS,
  // picked muscles fold into "+N picked" instead. Suggestions come from the gym's pool only:
  // community muscles are picked on purpose, from + MUSCLES.
  const suggestions = byTraining
    .filter((concept) => concept.featured)
    .map((concept) => concept.tag)
    .filter((tag) => !picked.includes(tag));
  const ready = concepts !== undefined && (!user || answers !== undefined);
  const [slots, setSlots] = useState<string[]>([]);
  const shown = arrangeChips(slots, picked, suggestions);
  useEffect(() => {
    if (ready && shown.join() !== slots.join()) setSlots(shown);
  }, [ready, shown, slots]);
  const hidden = active.length - shown.length;
  const hiddenPicked = picked.filter((tag) => !shown.includes(tag)).length;

  return (
    <div className="relative z-20 border-y-2 border-line bg-card/95 backdrop-blur-sm md:sticky md:top-0">
      <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 max-sm:px-4">
        {/* The same width on every page, so nothing after it moves. */}
        <span className="min-w-[7.5rem] font-display text-[9px] text-faded">
          {onTrainPage ? "TRAINING" : "NEXT WORKOUT"}
        </span>

        {/* First in the row, so adding muscles never moves it. */}
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(!pickerOpen)}
          title="Search the gym's muscles and the community's, or add a new one"
          className="inline-flex items-center gap-2 border-2 border-line px-2 py-0.5 text-xs font-semibold hover:bg-muted aria-expanded:bg-muted"
        >
          + MUSCLES
          {hidden > 0 && <span className="text-[10px] text-faded">{hidden} more</span>}
        </button>

        {/* Chips never shrink or truncate: the row wraps if it must, and MAX_CHIPS keeps it short. */}
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 xl:basis-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1">
          {shown.map((tag) => {
            const isPicked = picked.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={isPicked}
                onClick={() => toggle(tag)}
                title={`#${tag}: ${isPicked ? "remove from" : "add to"} the workout`}
                className={`shrink-0 border-2 px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition ${
                  isPicked
                    ? "border-line bg-pixel text-paper"
                    : "border-ink/30 bg-paper text-ink/70 hover:border-line hover:text-ink"
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {hiddenPicked > 0 && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              title="See all picked muscles"
              className="shrink-0 border-2 border-line bg-paper px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-pixel hover:bg-muted"
            >
              +{hiddenPicked} picked
            </button>
          )}
          {picked.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="shrink-0 text-[11px] font-semibold text-blue underline decoration-blue/40 underline-offset-2 hover:decoration-blue"
            >
              clear
            </button>
          )}
        </div>

        {/* Reviewer mode trains what's still to check: a label saying so, apart from the muscle chips. */}
        {reviewing && (
          <span
            title="Reviewer mode trains the exercises still to check on your muscles"
            className="flex shrink-0 items-center border-2 border-blue bg-blue-tint px-3 py-1.5 font-display text-[9px] leading-none whitespace-nowrap text-blue"
          >
            TO VERIFY
          </span>
        )}

        {/* Same width either way, so the bar doesn't jump when the workout starts. */}
        {onTrainPage ? (
          <span
            className="inline-flex min-w-44 items-center justify-center gap-2 border-2 border-transparent max-sm:hidden px-4 py-2.5 font-display text-[9px] leading-none text-pixel"
            title="You're training: the next exercise comes from these muscles"
          >
            <span className="size-1.5 rounded-full bg-pixel" aria-hidden="true" /> TRAINING
          </span>
        ) : (
          <Link
            to="/train"
            title={picked.length === 0 ? "Nothing picked: train all the gym's muscles" : undefined}
            className={`${buttonClass("pixel", "md")} min-w-44 max-sm:w-full`}
          >
            START TRAINING →
          </Link>
        )}
      </div>

      {pickerOpen && (
        <MusclePicker
          muscles={byTraining}
          picked={picked}
          onToggle={toggle}
          onClose={() => setPickerOpen(false)}
          canAddConcepts={(user?.canAddConcepts ?? false) && (reviewing || user?.role === "MEMBER")}
        />
      )}
      <ErrorMessage error={error} />
    </div>
  );
}

/**
 * Drops down from the bar: filter and toggle muscles without leaving the page. The gym's muscles
 * first (its pool: what "nothing picked" trains), then the community's, members' own muscles.
 */
function MusclePicker({
  muscles,
  picked,
  onToggle,
  onClose,
  canAddConcepts,
}: {
  muscles: { tag: string; name: string; featured: boolean }[];
  picked: string[];
  onToggle: (tag: string) => void;
  onClose: () => void;
  /** Whether to offer "+ add a muscle": only to whoever may add one. */
  canAddConcepts: boolean;
}) {
  const [filter, setFilter] = useState("");
  const search = filter.trim().toLowerCase();
  const matching = muscles.filter(
    (muscle) => muscle.name.toLowerCase().includes(search) || muscle.tag.includes(search),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="border-t-2 border-ink/15">
      <div className="mx-auto max-h-[50vh] w-full max-w-[96rem] overflow-y-auto px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="grep muscles..."
            aria-label="Filter muscles"
            className={`w-full ${fieldFrameClass} px-3 py-1.5 text-sm outline-none placeholder:text-ink/35 sm:w-64`}
          />
          <span className="flex-1 text-[11px] text-faded">
            tap to add or remove · nothing picked = all the gym's muscles
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-display text-[9px] underline hover:text-blue"
          >
            DONE
          </button>
        </div>

        {[
          { label: "GYM", hint: "the gym's pool, curated by its staff", featured: true },
          {
            label: "COMMUNITY",
            hint: "members' own muscles, curated by their owners",
            featured: false,
          },
        ].map((group, _, groups) => {
          const inGroup = matching.filter((muscle) => muscle.featured === group.featured);
          // One group alone needs no heading: only when both have muscles.
          const bothShown = groups.every((g) =>
            matching.some((muscle) => muscle.featured === g.featured),
          );
          return (
            inGroup.length > 0 && (
              <div key={group.label} className="mt-3">
                {bothShown && (
                  <p className="font-display text-[8px] text-faded">
                    {group.label}
                    <span className="ml-2 font-body text-[10px]">// {group.hint}</span>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {inGroup.map((muscle) => {
                    const isPicked = picked.includes(muscle.tag);
                    return (
                      <button
                        key={muscle.tag}
                        type="button"
                        aria-pressed={isPicked}
                        title={`#${muscle.tag}`}
                        onClick={() => onToggle(muscle.tag)}
                        className={`border-2 px-2 py-1 text-xs font-semibold transition ${
                          isPicked
                            ? "pixel-shadow-sm border-line bg-pixel text-paper"
                            : "border-ink/30 bg-paper hover:border-line"
                        }`}
                      >
                        {muscle.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          );
        })}

        <div className="mt-3 flex flex-wrap gap-2">
          {matching.length === 0 && (
            <span className="text-xs text-faded">// no muscles match "{filter.trim()}"</span>
          )}
          {canAddConcepts && (
            <Link
              to="/coach"
              search={{ tab: "muscles", new: true }}
              onClick={onClose}
              title="A muscle is a topic to train: add one and coach exercises for it"
              className="border-2 border-dashed border-ink/50 px-2 py-1 text-xs font-semibold hover:border-line"
            >
              + add a muscle
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

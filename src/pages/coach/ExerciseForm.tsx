import { Link, useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useConcepts, useSubmitQuestion, useUpdateQuestion } from "@/api/queries";
import type { Question } from "@/api/types";
import { PlatePicker } from "@/components/LoadMeter";
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  Field,
  fieldFrameClass,
  indentOnTab,
  inputClass,
  RichText,
} from "@/components/ui";

/**
 * Submits a question ("exercise") linked to one or more concepts ("muscles"), or edits one when
 * `editing` is given: prefilled, saved in place, then back to YOUR EXERCISES. Render with
 * key={editing?.id} so switching between exercises starts from the right values.
 */
export function ExerciseForm({ editing }: { editing?: Question }) {
  const navigate = useNavigate();
  const submitQuestion = useSubmitQuestion();
  const updateQuestion = useUpdateQuestion();
  const saving = editing ? updateQuestion : submitQuestion;

  const [conceptTags, setConceptTags] = useState<string[]>(editing?.conceptTags ?? []);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [requirement, setRequirement] = useState(editing?.requirement ?? "");
  const [sampleSolution, setSampleSolution] = useState(editing?.sampleSolution ?? "");
  const [difficultyScore, setDifficultyScore] = useState(editing?.difficultyScore ?? 3);
  const [source, setSource] = useState(editing?.source ?? "");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const exercise = {
      conceptTags,
      title: title.trim(),
      requirement: requirement.trim(),
      sampleSolution: sampleSolution.trim(),
      difficultyScore,
      ...(source.trim() && { source: source.trim() }),
    };
    if (editing) {
      updateQuestion.mutate(
        { id: editing.id, change: exercise },
        { onSuccess: () => navigate({ to: "/coach", search: { tab: "yours" } }) },
      );
    } else {
      submitQuestion.mutate(exercise, {
        onSuccess: () => {
          setTitle("");
          setRequirement("");
          setSampleSolution("");
          setSource("");
        },
      });
    }
  };

  return (
    <Card>
      {editing && (
        <div className="-mx-6 -mt-6 mb-6 flex flex-wrap items-center justify-between gap-3 border-b-2 border-line bg-amber/30 px-6 py-3">
          <p className="flex items-center gap-3 text-xs font-semibold">
            <Badge color="amber">EDITING</Badge>
            exercise #{editing.id}
            {editing.status === "RETIRED" && <Badge color="muted">BENCHED</Badge>}
          </p>
          <Link
            to="/coach"
            search={{ tab: "yours" }}
            className="text-[11px] font-semibold text-faded underline hover:text-ink"
          >
            cancel, back to your exercises
          </Link>
        </div>
      )}
      <form onSubmit={onSubmit}>
        <MusclePicker selected={conceptTags} onChange={setConceptTags} />

        <Field label="TITLE" hint="a short name, shown above the exercise and in lists">
          <input
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
            placeholder="Generic arrays"
          />
        </Field>

        <p className="mt-5 text-[11px] text-faded">
          // code: put it between two lines of ``` (add the language after the first one, like
          ```java). `backticks` mark code inside a sentence, **double asterisks** make it bold.
          <br />
          // syntax colours: java for now; other languages show as plain code.
          <br />
          // tab indents; esc, then tab moves on to the next field.
        </p>
        <TextEditor
          label="THE EXERCISE"
          hint="the question or task, as the athlete will see it"
          value={requirement}
          onChange={setRequirement}
          placeholder={"Why doesn't this compile?\n\n```java\nT[] items = new T[10];\n```"}
        />
        <TextEditor
          label="MODEL ANSWER"
          hint="shown after the athlete submits their own answer"
          value={sampleSolution}
          onChange={setSampleSolution}
          placeholder="Because of type erasure: ..."
        />

        <PlatePicker
          label="LOAD"
          value={difficultyScore}
          onChange={setDifficultyScore}
          lowLabel="warm-up"
          highLabel="max effort"
        />

        <Field
          label="SOURCE"
          optional
          hint="who came up with it: a book, a talk, a page (with its link); at most 200 characters"
        >
          {/* Two lines tall, so a title plus a long link fits; it's still one line of text. */}
          <textarea
            rows={2}
            maxLength={200}
            value={source}
            onChange={(event) => setSource(event.target.value.replace(/\s*\n\s*/g, " "))}
            className={`${inputClass} h-16 resize-none leading-relaxed`}
            placeholder="Effective Java, item 28"
          />
        </Field>

        <ErrorMessage error={saving.error} />

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={saving.isPending || conceptTags.length === 0}>
            {editing
              ? saving.isPending
                ? "SAVING..."
                : "SAVE CHANGES"
              : saving.isPending
                ? "PUSHING..."
                : "PUSH THIS EXERCISE"}
          </Button>
          {submitQuestion.isSuccess && (
            <p role="status" className="flex-1 text-xs font-semibold text-pixel">
              ✓ exercise pushed: it's live on open muscles, and waits for a spot where the muscle's
              owner approves new exercises
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

/**
 * One pane for long text and code, with two tabs: WRITE (the field) and PREVIEW (how athletes
 * will see it). The field grows with its text, so it never shows a scrollbar of its own; the
 * preview keeps the field's last height, so switching tabs doesn't make the page jump.
 */
function TextEditor({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [height, setHeight] = useState<number>();
  const field = useRef<HTMLTextAreaElement>(null);

  // Grow (or shrink) the field to fit its text, never below its minimum height.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
    setHeight(element.offsetHeight);
  }, [value, mode]);

  const tabClass = (tab: typeof mode) =>
    `px-3 py-2 font-display text-[8px] leading-none transition ${
      mode === tab ? "text-ink" : "text-faded hover:text-ink"
    } ${mode === tab ? "border-b-2 border-pixel" : "border-b-2 border-transparent"}`;

  return (
    <div className="mt-5 min-w-0">
      <span className="font-display text-[9px] text-ink/70">{label}</span>
      <div className={`mt-2 ${fieldFrameClass}`}>
        <div role="tablist" aria-label={label} className="flex border-b border-ink/15 px-1">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "write"}
            className={tabClass("write")}
            onClick={() => setMode("write")}
          >
            WRITE
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={tabClass("preview")}
            onClick={() => setMode("preview")}
          >
            PREVIEW
          </button>
        </div>
        {mode === "write" ? (
          <textarea
            ref={field}
            aria-label={label}
            maxLength={10000}
            required
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => indentOnTab(event, onChange)}
            spellCheck={false}
            className="block min-h-[26rem] w-full resize-none overflow-hidden bg-transparent px-4 py-3 text-xs leading-relaxed text-ink outline-none placeholder:text-ink/35"
            placeholder={placeholder}
          />
        ) : (
          <div
            aria-label={`${label} preview`}
            className="min-h-[26rem] px-4 py-3"
            style={{ minHeight: height }}
          >
            {value.trim() ? (
              <RichText text={value} />
            ) : (
              <p className="text-xs text-faded">// nothing to preview yet: write something first</p>
            )}
          </div>
        )}
      </div>
      <span className="mt-1.5 block text-[11px] text-faded">{hint}</span>
    </div>
  );
}

/**
 * Toggle chips for the muscles an exercise trains: only published muscles can be picked. A filter
 * (name or tag, any case, as in the workout bar) narrows the chips; picked muscles always stay.
 */
function MusclePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const { data: concepts, isPending, error } = useConcepts();
  const [filter, setFilter] = useState("");
  const search = filter.trim().toLowerCase();
  // Published muscles, plus any the exercise already works that were retired since, so an edit
  // can remove them.
  const offered =
    concepts?.filter(
      (concept) =>
        (concept.status === "ACTIVE" || selected.includes(concept.tag)) &&
        (selected.includes(concept.tag) ||
          concept.name.toLowerCase().includes(search) ||
          concept.tag.includes(search)),
    ) ?? [];

  const toggle = (tag: string) =>
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);

  return (
    <fieldset>
      <legend className="font-display text-[9px] text-ink/70">TARGET MUSCLES</legend>
      <input
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        // Enter here filters; it must not submit the exercise.
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
        placeholder="grep muscles..."
        aria-label="Filter muscles"
        className={`mt-2 w-full ${fieldFrameClass} px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink/35 sm:w-64`}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {isPending && <span className="text-xs text-faded">// warming up...</span>}
        {offered.map((concept) => {
          const isSelected = selected.includes(concept.tag);
          return (
            <button
              key={concept.tag}
              type="button"
              aria-pressed={isSelected}
              title={
                concept.status === "ACTIVE"
                  ? concept.name
                  : `${concept.name} (${concept.status.toLowerCase()})`
              }
              onClick={() => toggle(concept.tag)}
              className={`border-2 px-2 py-1 text-xs font-semibold transition ${
                isSelected
                  ? "pixel-shadow-sm border-line bg-pixel text-paper"
                  : "border-ink/30 bg-paper hover:border-line"
              }`}
            >
              {concept.tag}
              {concept.status !== "ACTIVE" && ` (${concept.status.toLowerCase()})`}
            </button>
          );
        })}
        <Link
          to="/coach"
          search={{ tab: "muscle" }}
          className="border-2 border-dashed border-ink/50 px-2 py-1 text-xs font-semibold hover:border-line"
        >
          + missing a muscle?
        </Link>
      </div>
      <p className="mt-1.5 text-[11px] text-faded">pick at least one</p>
      <ErrorMessage error={error} />
    </fieldset>
  );
}

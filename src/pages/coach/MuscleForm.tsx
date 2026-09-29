import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useCreateConcept, useUpdateConcept } from "@/api/queries";
import type { Concept, ContributionPolicy } from "@/api/types";
import { Badge, Button, Card, ErrorMessage, Field, inputClass } from "@/components/ui";

/** Turns "Java Generics!" into "java-generics", the kebab-case the API requires for tags. */
function toTag(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates a concept ("muscle"), owned by whoever adds it and on the gym floor straight away; or
 * edits one when `editing` is given (the tag, its id, stays). Render with key={editing?.tag}.
 */
export function MuscleForm({ editing }: { editing?: Concept }) {
  const navigate = useNavigate();
  const createConcept = useCreateConcept();
  const updateConcept = useUpdateConcept();
  const saving = editing ? updateConcept : createConcept;

  const [name, setName] = useState(editing?.name ?? "");
  const [tag, setTag] = useState(editing?.tag ?? "");
  const [tagEdited, setTagEdited] = useState(editing !== undefined);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [references, setReferences] = useState(editing?.externalReferences.join("\n") ?? "");
  const [contributionPolicy, setContributionPolicy] = useState<ContributionPolicy>(
    editing?.contributionPolicy ?? "AUTO_ACCEPT",
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const muscle = {
      name: name.trim(),
      description: description.trim(),
      externalReferences: references
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      contributionPolicy,
    };
    if (editing) {
      updateConcept.mutate(
        { tag: editing.tag, change: muscle },
        { onSuccess: () => navigate({ to: "/coach", search: { tab: "muscle" } }) },
      );
    } else {
      createConcept.mutate(
        { tag, ...muscle },
        {
          onSuccess: () => {
            setName("");
            setTag("");
            setTagEdited(false);
            setDescription("");
            setReferences("");
            setContributionPolicy("AUTO_ACCEPT");
          },
        },
      );
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 font-display text-xs">
            {editing ? (
              <>
                <Badge color="amber">EDITING</Badge> {editing.name.toUpperCase()}
              </>
            ) : (
              "NEW MUSCLE"
            )}
          </h2>
          {editing && (
            <Link
              to="/coach"
              search={{ tab: "muscle" }}
              className="text-[11px] font-semibold text-faded underline hover:text-ink"
            >
              cancel
            </Link>
          )}
        </div>

        <Field label="NAME">
          <input
            required
            maxLength={200}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!tagEdited) setTag(toTag(event.target.value));
            }}
            className={inputClass}
            placeholder="Java Generics"
          />
        </Field>

        <Field
          label="TAG"
          hint={
            editing
              ? "the muscle's id: it can't be renamed"
              : "kebab-case; it's the muscle's id and can't be renamed later"
          }
        >
          <input
            required
            readOnly={editing !== undefined}
            maxLength={100}
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              setTagEdited(true);
            }}
            className={`${inputClass} read-only:opacity-60`}
            placeholder="java-generics"
          />
        </Field>

        <Field
          label="DESCRIPTION"
          hint="what it is in a sentence or two; then, after a blank line, what it covers"
        >
          <textarea
            required
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${inputClass} h-48 resize-y leading-relaxed`}
            placeholder={
              "how would you explain this to a teammate?\n\nCovers: generics · type erasure · wildcards"
            }
          />
        </Field>

        <Field label="REFERENCES" optional hint="one link per line: docs, specs, articles">
          <textarea
            value={references}
            onChange={(event) => setReferences(event.target.value)}
            spellCheck={false}
            className={`${inputClass} h-32 resize-y leading-relaxed`}
            placeholder={"https://dev.java/learn/generics/\nhttps://docs.oracle.com/javase/specs/"}
          />
        </Field>

        <label className="mt-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={contributionPolicy === "OWNER_APPROVAL"}
            onChange={(event) =>
              setContributionPolicy(event.target.checked ? "OWNER_APPROVAL" : "AUTO_ACCEPT")
            }
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-pixel"
          />
          <span>
            <span className="block text-xs font-bold">Approve other coaches' exercises</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-faded">
              On: exercises other coaches add to this muscle wait for you in the spot check. Off:
              they go live straight away. Your own exercises always go live straight away.
            </span>
          </span>
        </label>

        <ErrorMessage error={saving.error} />
        {createConcept.isSuccess && (
          <p role="status" className="mt-4 text-xs font-semibold text-pixel">
            {/* Members' new muscles wait as drafts while only gym staff publish them. */}
            {createConcept.data.status === "DRAFT"
              ? "✓ saved as a draft: gym staff will take a look and put it on the floor"
              : "✓ muscle added to the gym floor"}
          </p>
        )}

        <Button type="submit" variant="pixel" className="mt-6 w-full" disabled={saving.isPending}>
          {editing
            ? saving.isPending
              ? "SAVING..."
              : "SAVE CHANGES"
            : saving.isPending
              ? "COMMITTING..."
              : "COMMIT THIS MUSCLE"}
        </Button>
      </form>
    </Card>
  );
}

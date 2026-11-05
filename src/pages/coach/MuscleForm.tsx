import { useState, type FormEvent } from "react";
import { useCreateConcept, useUpdateConcept } from "@/api/queries";
import type { Concept, ContributionPolicy } from "@/api/types";
import { Button, Card, ErrorMessage, Field, inputClass } from "@/components/ui";

/** Turns "Java Generics!" into "java-generics", the kebab-case the API requires for tags. */
function toTag(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates a concept ("muscle"), owned by whoever adds it and published straight away as theirs; or
 * edits one when `editing` is given (the tag, its id, stays). `onDone` gets the tag once it's
 * saved; `onCancel` closes the form. Render with key={editing?.tag ?? "new"}.
 */
export function MuscleForm({
  editing,
  onDone,
  onCancel,
}: {
  editing?: Concept;
  onDone: (tag: string) => void;
  onCancel: () => void;
}) {
  const createConcept = useCreateConcept();
  const updateConcept = useUpdateConcept();
  const saving = editing ? updateConcept : createConcept;

  const [name, setName] = useState(editing?.name ?? "");
  const [tag, setTag] = useState(editing?.tag ?? "");
  const [tagEdited, setTagEdited] = useState(editing !== undefined);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [references, setReferences] = useState(editing?.externalReferences.join("\n") ?? "");
  const [contributionPolicy, setContributionPolicy] = useState<ContributionPolicy>(
    editing?.contributionPolicy ?? "OWNER_APPROVAL",
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
        { onSuccess: () => onDone(editing.tag) },
      );
    } else {
      createConcept.mutate({ tag, ...muscle }, { onSuccess: (created) => onDone(created.tag) });
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xs">{editing ? "EDIT MUSCLE" : "NEW MUSCLE"}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] font-semibold text-blue underline decoration-blue/40 underline-offset-2 hover:decoration-blue"
          >
            cancel
          </button>
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
              On: exercises other coaches add to this muscle wait for your approval in the INBOX.
              Off: they go live straight away. Your own exercises always go live straight away.
            </span>
          </span>
        </label>

        <ErrorMessage error={saving.error} />
        <Button type="submit" className="mt-6" disabled={saving.isPending}>
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

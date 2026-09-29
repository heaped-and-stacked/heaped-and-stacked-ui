import { getRouteApi, Link } from "@tanstack/react-router";
import type { ButtonHTMLAttributes } from "react";
import {
  useConcepts,
  useDeleteConcept,
  useQuestion,
  useReports,
  useReviews,
  useUpdateConceptStatus,
} from "@/api/queries";
import { curatesAllContent, type Concept, type CurrentUser, type User } from "@/api/types";
import { RequireSignIn } from "@/components/RequireSignIn";
import {
  Badge,
  Button,
  buttonClass,
  Card,
  ErrorMessage,
  Loading,
  PageHeading,
} from "@/components/ui";
import { contributionPolicyLabels } from "@/labels";
import { ExerciseForm } from "./ExerciseForm";
import { MuscleForm } from "./MuscleForm";
import { MyExercises } from "./MyExercises";
import { Reports } from "./Reports";
import { SpotCheck } from "./SpotCheck";

const route = getRouteApi("/coach");

const coachTabs = {
  exercise: {
    label: "ADD EXERCISE",
    about: "Write a question or task for one or more muscles, with the answer you'd expect.",
  },
  muscle: {
    label: "MUSCLES",
    about:
      "A muscle is a topic to train, like java-concurrency or sql-joins. Exercises hang on muscles.",
  },
  yours: {
    label: "YOUR EXERCISES",
    about:
      "Everything you've coached, newest first. TRY IT shows an exercise the way athletes see it; EDIT fixes it.",
  },
  spot: {
    label: "SPOT CHECK",
    about: "Exercises others added to muscles where you approve new ones. Accept what fits.",
  },
  reports: {
    label: "FEEDBACK",
    about:
      "Athletes' feedback on your exercises and on exercises on your muscles. Fix what's wrong, dismiss what isn't a problem, and note the praise.",
  },
} as const;

export type CoachTab = keyof typeof coachTabs;

export function isCoachTab(value: unknown): value is CoachTab {
  return typeof value === "string" && value in coachTabs;
}

/**
 * Where members write content for others, one tab at a time: new exercises (questions) and
 * muscles (concepts), their own exercises, approving exercises others add to their muscles, and
 * deciding athletes' reports.
 * `?edit=` turns the exercise or muscle form into an edit of that exercise id or muscle tag.
 */
export function CoachsCornerPage() {
  return (
    <RequireSignIn area="coach's corner">{(user) => <CoachsCorner user={user} />}</RequireSignIn>
  );
}

function CoachsCorner({ user }: { user: CurrentUser }) {
  const { tab: requested = "exercise", edit } = route.useSearch();
  // While only staff add content, members can still edit what they wrote, but adding is hidden:
  // no ADD EXERCISE tab (its form still opens for an edit), and they start on YOUR EXERCISES.
  const adding = requested === "exercise" && !edit;
  const tab: CoachTab = adding && !user.canContribute ? "yours" : requested;
  const tabs = (Object.keys(coachTabs) as CoachTab[]).filter(
    (id) => id !== "exercise" || user.canContribute || tab === "exercise",
  );
  const { data: reviews } = useReviews();
  const { data: reports } = useReports();
  const { data: concepts } = useConcepts();
  const waiting = reviews?.length ?? 0;
  const openReports = reports?.length ?? 0;
  const isStaff = curatesAllContent(user.role);
  // Members' draft muscles waiting for staff to publish them (the list only has them for staff).
  const draftsToPublish = isStaff
    ? (concepts?.filter((concept) => concept.status === "DRAFT" && concept.createdBy !== user.id)
        .length ?? 0)
    : 0;

  return (
    <>
      <PageHeading prompt="git checkout -b new-exercise" title="COACH'S CORNER">
        <span className="block">
          Add exercises for others to train with, and muscles to hang them on.
        </span>
        <span className="block">
          Muscles you add are yours: you decide whether other people's exercises train them.
        </span>
      </PageHeading>

      <nav
        className="mt-10 flex flex-wrap gap-2 border-b-2 border-line"
        aria-label="Coach's corner"
      >
        {tabs.map((id) => (
          <Link
            key={id}
            to="/coach"
            search={{ tab: id }}
            // The router marks the link matching path AND tab as the current page.
            activeOptions={{ includeSearch: true }}
            className={`-mb-0.5 flex items-center gap-2 border-2 border-line px-4 py-3 font-display text-[9px] leading-none transition ${
              tab === id
                ? "border-b-card bg-card"
                : "bg-muted text-ink/70 hover:bg-card hover:text-ink"
            }`}
          >
            {id === "exercise" && tab === "exercise" && edit
              ? "EDIT EXERCISE"
              : coachTabs[id].label}
            {id === "muscle" && draftsToPublish > 0 && (
              <Badge color="amber">{draftsToPublish}</Badge>
            )}
            {id === "spot" && waiting > 0 && <Badge color="amber">{waiting}</Badge>}
            {id === "reports" && openReports > 0 && <Badge color="amber">{openReports}</Badge>}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-xs font-medium text-faded">
        // {coachTabs[tab].about}
        {tab === "spot" && isStaff && " As gym staff, you spot for everyone's muscles."}
        {tab === "yours" && isStaff && " As gym staff, you see everyone's exercises."}
        {tab === "reports" && isStaff && " As gym staff, you see all feedback."}
      </p>

      <div className="mt-6">
        {tab === "exercise" && <ExerciseTab edit={edit} />}
        {tab === "muscle" && <MuscleTab edit={edit} user={user} canAdd={user.canContribute} />}
        {tab === "yours" && <MyExercises isStaff={isStaff} />}
        {tab === "spot" && <SpotCheck />}
        {tab === "reports" && <Reports user={user} />}
      </div>
    </>
  );
}

/**
 * The exercise form: empty to add one, or filled with an exercise to edit it (the user's own, or
 * any for staff).
 */
function ExerciseTab({ edit }: { edit: number | string | undefined }) {
  const editId = edit ? Number(edit) : undefined;
  const { data: editing, isPending, error } = useQuestion(editId);
  if (!edit) return <ExerciseForm key="new" />;
  if (isPending && !error) return <Loading what="finding that exercise" />;

  if (!editing)
    return <NotFoundHere what={`Exercise #${edit} isn't one you can edit.`} tab="yours" />;
  return <ExerciseForm key={editing.id} editing={editing} />;
}

/**
 * The muscle form (add, or edit with ?edit=tag) next to the muscles the user manages. Without the
 * right to add (`canAdd`), the form only opens to edit one.
 */
function MuscleTab({
  edit,
  user,
  canAdd,
}: {
  edit: number | string | undefined;
  user: User;
  canAdd: boolean;
}) {
  const { data: concepts, isPending } = useConcepts();
  const editing = edit ? concepts?.find((concept) => concept.tag === String(edit)) : undefined;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      {edit && isPending ? (
        <Loading what="finding that muscle" />
      ) : edit && !editing ? (
        <NotFoundHere what={`There's no muscle #${edit}.`} tab="muscle" />
      ) : editing || canAdd ? (
        <MuscleForm key={editing?.tag ?? "new"} editing={editing} />
      ) : (
        <Card>
          <p className="text-xs font-medium text-faded">
            // only gym staff add muscles for now. edit yours from the list.
          </p>
        </Card>
      )}
      <YourMuscles user={user} />
    </div>
  );
}

function NotFoundHere({ what, tab }: { what: string; tab: CoachTab }) {
  return (
    <Card>
      <p className="text-sm font-medium text-ink/70">{what}</p>
      <Link to="/coach" search={{ tab }} className={`${buttonClass("paper")} mt-4`}>
        BACK
      </Link>
    </Card>
  );
}

/**
 * Next to the muscle form: what a muscle is for, and the muscles the user manages (their own;
 * all of them for staff), each with what they may do: edit, delete (staff, for duplicates; only
 * while no exercise uses it, the API says so otherwise), and bring back for one retired earlier.
 */
function YourMuscles({ user }: { user: User }) {
  const { data: concepts } = useConcepts();
  const updateStatus = useUpdateConceptStatus();
  const deleteConcept = useDeleteConcept();
  const isStaff = curatesAllContent(user.role);
  const managed = concepts?.filter((concept) => isStaff || concept.createdBy === user.id) ?? [];
  const busy = updateStatus.isPending || deleteConcept.isPending;

  const confirmDelete = (concept: Concept) => {
    if (window.confirm(`Delete the muscle "${concept.name}" for good? This can't be undone.`)) {
      deleteConcept.mutate(concept.tag);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xs">HOW MUSCLES WORK</h2>
      <ul className="mt-4 grid gap-3 text-xs leading-relaxed text-ink/80">
        <li>▸ Athletes pick muscles in the bar at the top, then train on their exercises.</li>
        <li>▸ Every exercise works at least one muscle; one muscle holds many exercises.</li>
        <li>
          ▸ The muscle is yours. You decide whether exercises other coaches add go live straight
          away, or wait for your approval in the spot check.
        </li>
        {isStaff && <li>▸ Delete clears a muscle no exercise uses yet, such as a duplicate.</li>}
      </ul>

      <h3 className="mt-6 border-t-2 border-dashed border-ink/15 pt-4 font-display text-[9px] text-ink/70">
        {isStaff ? "ALL MUSCLES" : "YOUR MUSCLES"}
      </h3>
      <ErrorMessage error={updateStatus.error ?? deleteConcept.error} />
      {managed.length === 0 ? (
        <p className="mt-3 text-xs text-faded">// none yet: your first one goes here</p>
      ) : (
        <ul className="mt-3 grid max-h-[28rem] grid-cols-[minmax(0,1fr)] gap-3 overflow-y-auto pr-1">
          {managed.map((concept) => (
            // Drafts and retired muscles say so in their details line; they aren't dimmed, so
            // their text and buttons stay readable.
            <li key={concept.tag} className="flex items-start gap-3 text-xs">
              {/* The text shrinks and truncates; the buttons keep their place on the right. */}
              <div className="min-w-0 flex-1">
                <span className="block truncate font-bold" title={concept.name}>
                  {concept.name}
                </span>
                <span className="block truncate text-[11px] text-faded">
                  #{concept.tag} ·{" "}
                  {concept.status === "DRAFT"
                    ? isStaff
                      ? "draft · "
                      : "draft, waiting for gym staff · "
                    : concept.status === "RETIRED"
                      ? "retired · "
                      : ""}
                  {contributionPolicyLabels[concept.contributionPolicy]}
                </span>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Link
                  to="/coach"
                  search={{ tab: "muscle", edit: concept.tag }}
                  className="border-2 border-line px-1.5 py-0.5 text-[10px] font-semibold hover:bg-muted"
                >
                  edit
                </Link>
                {/* Staff publish members' drafts (while only staff publish muscles). */}
                {concept.status === "DRAFT" && isStaff && (
                  <SmallAction
                    disabled={busy}
                    onClick={() => updateStatus.mutate({ tag: concept.tag, status: "ACTIVE" })}
                    title="Put it on the gym floor, for everyone to train"
                  >
                    publish
                  </SmallAction>
                )}
                {/* Only for a muscle retired in the past: no button retires one anymore. */}
                {concept.status === "RETIRED" && (
                  <SmallAction
                    disabled={busy}
                    onClick={() => updateStatus.mutate({ tag: concept.tag, status: "ACTIVE" })}
                    title="Back on the gym floor"
                  >
                    bring back
                  </SmallAction>
                )}
                {(isStaff || concept.status === "DRAFT") && (
                  <SmallAction
                    disabled={busy}
                    danger
                    onClick={() => confirmDelete(concept)}
                    title="For duplicates and mistakes: only while no exercise uses the muscle"
                  >
                    delete
                  </SmallAction>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A compact button for the actions in the muscle list. */
function SmallAction({
  danger = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <Button
      variant={danger ? "danger" : "paper"}
      className="px-1.5! py-0.5! font-body! text-[10px]! font-semibold shadow-none!"
      {...props}
    />
  );
}

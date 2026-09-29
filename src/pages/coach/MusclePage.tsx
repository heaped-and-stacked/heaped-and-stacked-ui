import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  useConceptWorkload,
  useConcepts,
  useDeleteConcept,
  useFeatureConcept,
  useUpdateConceptStatus,
} from "@/api/queries";
import { curatesAllContent, type Concept, type CurrentUser } from "@/api/types";
import { RequireSignIn } from "@/components/RequireSignIn";
import { ReviewerModeNeeded, useReviewer } from "@/components/ReviewerMode";
import { Button, buttonClass, Card, ErrorMessage, Loading, Prompt } from "@/components/ui";
import { contributionPolicyLabels } from "@/labels";
import { useTrainToVerify } from "../rack/TrainPage";
import { KindBadge, SmallAction, WorkloadLine } from "./CoachsCornerPage";
import { MuscleForm } from "./MuscleForm";

const route = getRouteApi("/coach/muscles/$tag");

/**
 * One muscle the user curates (their own, or the gym's for staff): what it is, how far its
 * exercises are verified, and what may be done to it (edit, publish, feature, retire, delete).
 * The work itself happens elsewhere: TRAIN THE N TO VERIFY starts a workout on it from the pool to
 * verify (the rack: REVIEW, ✓ VERIFY, ✎ FIX); N TO APPROVE opens the INBOX; SEE ALL EXERCISES the
 * EXERCISES tab on this muscle. + NEW EXERCISE starts one on this muscle.
 */
export function MusclePage() {
  return <RequireSignIn area="coach's corner">{(user) => <Muscle user={user} />}</RequireSignIn>;
}

function Muscle({ user }: { user: CurrentUser }) {
  const { tag } = route.useParams();
  const { data: concepts, isPending, error } = useConcepts();
  const concept = concepts?.find((candidate) => candidate.tag === tag);
  const isStaff = curatesAllContent(user.role);
  const curates = !!concept && (concept.createdBy === user.id || (isStaff && concept.featured));
  const { reviewing } = useReviewer();
  const navigate = useNavigate();

  if (isPending) return <Loading what="warming up the muscle" />;
  if (error) return <ErrorMessage error={error} />;
  if (curates && !reviewing) {
    return (
      <ReviewerModeNeeded
        text={`#${tag} is one of the muscles you look after.`}
        onBack={() => navigate({ to: "/coach" })}
      />
    );
  }
  if (!concept || !curates) {
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <p className="text-sm font-medium text-ink/70">
          {concept ? `#${tag} isn't a muscle you look after.` : `There's no muscle #${tag}.`}
        </p>
        <Link to="/coach" className={`${buttonClass("paper")} mt-6`}>
          BACK TO MUSCLES
        </Link>
      </Card>
    );
  }
  return <MuscleView key={concept.tag} concept={concept} user={user} isStaff={isStaff} />;
}

function MuscleView({
  concept,
  user,
  isStaff,
}: {
  concept: Concept;
  user: CurrentUser;
  isStaff: boolean;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const { data: workload } = useConceptWorkload();
  const trainToVerify = useTrainToVerify();
  const counts = workload?.find((entry) => entry.tag === concept.tag);
  const toVerify = counts?.toVerify ?? 0;
  const waiting = counts?.waiting ?? 0;

  return (
    <>
      <Link
        to="/coach"
        search={{ tab: "muscles" }}
        className="text-[11px] font-semibold text-blue underline decoration-blue/40 underline-offset-2 hover:decoration-blue"
      >
        ← muscles
      </Link>
      <header className="mt-6">
        <Prompt>cd muscles/{concept.tag}</Prompt>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl leading-relaxed md:text-2xl">
              {concept.name.toUpperCase()}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-faded">
              <span>#{concept.tag}</span>
              <KindBadge concept={concept} />
              <span>{contributionPolicyLabels[concept.contributionPolicy]}</span>
              <WorkloadLine workload={counts} />
            </p>
          </div>
          {user.canAddQuestions && (
            <Link
              to="/coach/exercises/new"
              search={{ muscle: concept.tag }}
              className={buttonClass("ink", "md")}
            >
              + NEW EXERCISE
            </Link>
          )}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink/80">{concept.description}</p>
      </header>

      {editing ? (
        <div className="mt-6 max-w-2xl">
          <MuscleForm
            key={concept.tag}
            editing={concept}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <MuscleActions
          concept={concept}
          user={user}
          isStaff={isStaff}
          onEdit={() => setEditing(true)}
          onDeleted={() => navigate({ to: "/coach", search: { tab: "muscles" } })}
        />
      )}

      <section className="mt-10">
        <p className="font-display text-[9px] text-ink/70">THE WORK</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {toVerify > 0 ? (
            <Button
              variant="pixel"
              size="lg"
              onClick={() => trainToVerify([concept.tag])}
              title="A workout on this muscle with only the exercises still to check"
            >
              TRAIN THE {toVerify} TO VERIFY
            </Button>
          ) : (
            counts && (
              <span className="text-xs font-semibold text-pixel">
                ✓ every exercise here is verified
              </span>
            )
          )}
          {waiting > 0 && (
            <Link to="/coach" search={{ tab: "inbox" }} className={buttonClass("paper", "lg")}>
              {waiting} TO APPROVE
            </Link>
          )}
          <Link
            to="/coach"
            search={{ tab: "exercises", muscle: concept.tag }}
            className={buttonClass("paper", "lg")}
          >
            SEE ALL EXERCISES
          </Link>
        </div>
        {toVerify > 0 && (
          <p className="mt-3 text-[11px] text-faded">
            // a workout on this muscle with only what's still to check: REVIEW each exercise, then
            ✓ VERIFY or ✎ FIX it
          </p>
        )}
      </section>
    </>
  );
}

/**
 * What may be done to the muscle itself, as the API allows it: its owner edits, publishes, retires,
 * brings back and deletes it (once it's out of the gym's pool); staff edit the gym's muscles and
 * feature or unfeature them.
 */
function MuscleActions({
  concept,
  user,
  isStaff,
  onEdit,
  onDeleted,
}: {
  concept: Concept;
  user: CurrentUser;
  isStaff: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const updateStatus = useUpdateConceptStatus();
  const featureConcept = useFeatureConcept();
  const deleteConcept = useDeleteConcept();
  const busy = updateStatus.isPending || featureConcept.isPending || deleteConcept.isPending;
  const mine = concept.createdBy === user.id;

  const confirmDelete = () => {
    if (window.confirm(`Delete the muscle "${concept.name}" for good? This can't be undone.`)) {
      deleteConcept.mutate(concept.tag, { onSuccess: onDeleted });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <SmallAction onClick={onEdit}>EDIT MUSCLE</SmallAction>
        {mine && concept.status === "DRAFT" && (
          <SmallAction
            disabled={busy}
            onClick={() => updateStatus.mutate({ tag: concept.tag, status: "ACTIVE" })}
            title="Publish it: listed in the community, for everyone to train"
          >
            PUBLISH
          </SmallAction>
        )}
        {isStaff && concept.status === "ACTIVE" && !concept.houseOwned && (
          <SmallAction
            disabled={busy}
            onClick={() => featureConcept.mutate({ tag: concept.tag, featured: !concept.featured })}
            title={
              concept.featured
                ? "Take it out of the gym's pool: back to its owner's own, in the community"
                : "Take it into the gym's pool: part of all muscles, curated by staff too"
            }
          >
            {concept.featured ? "UNFEATURE" : "FEATURE"}
          </SmallAction>
        )}
        {mine && concept.status === "ACTIVE" && !concept.featured && (
          <SmallAction
            disabled={busy}
            onClick={() => updateStatus.mutate({ tag: concept.tag, status: "RETIRED" })}
            title="Out of every workout; its exercises and history are kept"
          >
            RETIRE
          </SmallAction>
        )}
        {mine && concept.status === "RETIRED" && (
          <SmallAction
            disabled={busy}
            onClick={() => updateStatus.mutate({ tag: concept.tag, status: "ACTIVE" })}
            title="Back on the gym floor"
          >
            BRING BACK
          </SmallAction>
        )}
        {mine && !concept.featured && (
          <SmallAction
            danger
            disabled={busy}
            onClick={confirmDelete}
            title="Only while no exercise uses the muscle; otherwise retire it"
          >
            DELETE
          </SmallAction>
        )}
      </div>
      <p className="mt-3 max-w-3xl text-[11px] text-faded">
        //{" "}
        {concept.houseOwned
          ? "one of the gym's own muscles: part of all muscles in workouts; gym staff curate it, and it always stays in the gym"
          : concept.featured
            ? "a member's muscle in the gym's pool: part of all muscles; its owner and gym staff curate it. Unfeature it to give it back to its owner alone, as a community muscle"
            : "a community muscle: trained only when someone picks it; its owner curates it" +
              (isStaff
                ? ". FEATURE takes it into the gym's pool (all muscles), its owner keeping it"
                : "")}
      </p>
      <ErrorMessage error={updateStatus.error ?? featureConcept.error ?? deleteConcept.error} />
    </div>
  );
}

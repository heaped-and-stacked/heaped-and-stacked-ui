import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import type { ButtonHTMLAttributes } from "react";
import {
  useConceptWorkload,
  useConcepts,
  useFeatureConcept,
  useReports,
  useReviews,
  useUpdateConceptStatus,
} from "@/api/queries";
import {
  curatesAllContent,
  type Concept,
  type ConceptWorkload,
  type CurrentUser,
} from "@/api/types";
import { useReviewer } from "@/components/ReviewerMode";
import { RequireSignIn } from "@/components/RequireSignIn";
import {
  Badge,
  Button,
  buttonClass,
  ErrorMessage,
  Loading,
  PAGE_SIZE,
  PageHeading,
} from "@/components/ui";
import { MuscleForm } from "./MuscleForm";
import { MyExercises } from "./MyExercises";
import { Reports } from "./Reports";
import { ToApprove } from "./ToApprove";

const route = getRouteApi("/coach");

const coachTabs = {
  muscles: {
    label: "MUSCLES",
    about: "The muscles you look after, and what waits on each. Open one to work on its exercises.",
  },
  exercises: {
    label: "EXERCISES",
    about: "Every exercise you've written, newest first. Open one to edit it.",
  },
  inbox: {
    label: "INBOX",
    about: "Athletes' feedback on your exercises.",
  },
} as const;

/** In reviewer mode the tabs say what the curating adds. */
const reviewerAbout: Record<CoachTab, string> = {
  muscles: coachTabs.muscles.about,
  exercises:
    "The exercises you look after, newest first: yours, and the gym's for staff. Open one to edit it.",
  inbox: "What waits for you: exercises to approve for your muscles, and athletes' feedback.",
};

export type CoachTab = keyof typeof coachTabs;

export function isCoachTab(value: unknown): value is CoachTab {
  return typeof value === "string" && value in coachTabs;
}

/**
 * Coach's Corner. For everyone who adds exercises: EXERCISES (the ones they wrote, + NEW EXERCISE)
 * and INBOX (athletes' feedback on them). In reviewer mode (useReviewer) the curating comes in:
 * MUSCLES first (the muscles they curate, each with what waits on it; open one for its page),
 * EXERCISES with the gym's pool for staff, and the INBOX with exercises waiting for their approval.
 * Exercises are added and edited on one screen of their own (/coach/exercises/…), muscles worked
 * on at /coach/muscles/<tag>.
 */
export function CoachsCornerPage() {
  return (
    <RequireSignIn area="coach's corner">{(user) => <CoachsCorner user={user} />}</RequireSignIn>
  );
}

function CoachsCorner({ user }: { user: CurrentUser }) {
  const { reviewing } = useReviewer();
  const search = route.useSearch();
  const tabs: CoachTab[] = reviewing ? ["muscles", "exercises", "inbox"] : ["exercises", "inbox"];
  const tab: CoachTab =
    search.tab && tabs.includes(search.tab) ? search.tab : reviewing ? "muscles" : "exercises";
  const { new: addingMuscle, muscle } = search;
  // The INBOX's first pages: shared with the tab, for their totals. Approvals only when reviewing.
  const { data: reviews } = useReviews({ page: 0, size: PAGE_SIZE }, reviewing);
  const { data: reports } = useReports({ asMember: !reviewing, page: 0, size: PAGE_SIZE });
  const inbox = (reviewing ? (reviews?.totalItems ?? 0) : 0) + (reports?.totalItems ?? 0);
  const isStaff = curatesAllContent(user.role);

  return (
    <>
      <PageHeading prompt="cd coachs-corner" title="COACH'S CORNER">
        {reviewing
          ? isStaff
            ? "Look after the gym's muscles and their exercises: write, verify, approve, and act on feedback."
            : "Look after your muscles: what others add to them, and the feedback on them."
          : "Your exercises: write new ones for the gym's muscles, and read what athletes say about them."}
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
            className={`-mb-0.5 flex items-center gap-2 rounded-b-none border-2 border-line px-4 py-3 font-display text-[9px] leading-none transition ${
              tab === id
                ? "border-b-card bg-card text-blue"
                : "bg-muted text-ink/70 hover:bg-card hover:text-ink"
            }`}
          >
            {coachTabs[id].label}
            {id === "inbox" && inbox > 0 && <Badge color="amber">{inbox}</Badge>}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-xs font-medium text-faded">
        // {reviewing ? reviewerAbout[tab] : coachTabs[tab].about}
      </p>

      <div className="mt-6">
        {tab === "muscles" && <MusclesTab user={user} adding={addingMuscle === true} />}
        {tab === "exercises" && (
          <>
            {user.canAddQuestions && (
              <Link
                to="/coach/exercises/new"
                search={{ from: "exercises" }}
                className={`${buttonClass("ink", "md")} mb-4`}
              >
                + NEW EXERCISE
              </Link>
            )}
            <MyExercises
              key={`${muscle}-${reviewing}`}
              isStaff={isStaff && reviewing}
              muscle={muscle}
            />
          </>
        )}
        {tab === "inbox" && (
          <div className="grid gap-10">
            {reviewing && <ToApprove />}
            <section>
              <p className="font-display text-[9px] text-ink/70">FEEDBACK</p>
              <div className="mt-2">
                <Reports key={String(reviewing)} user={user} />
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The muscles the user curates, each with its workload: their own (any status), and for staff the
 * gym's pool, then the community's published muscles to feature (or take down). "+ NEW MUSCLE"
 * opens the form at the top; a new muscle opens on its own page.
 */
function MusclesTab({ user, adding }: { user: CurrentUser; adding: boolean }) {
  const navigate = useNavigate();
  const { data: concepts, isPending, error } = useConcepts();
  const { data: workload } = useConceptWorkload();
  const isStaff = curatesAllContent(user.role);
  const byName = (a: Concept, b: Concept) => a.name.localeCompare(b.name);
  const workloadOf = (tag: string) => workload?.find((entry) => entry.tag === tag);

  const yours = (concepts ?? []).filter((c) => c.createdBy === user.id).sort(byName);
  const gym = isStaff
    ? (concepts ?? []).filter((c) => c.featured && c.createdBy !== user.id).sort(byName)
    : [];
  const community = isStaff
    ? (concepts ?? [])
        .filter((c) => !c.featured && c.createdBy !== user.id && c.status !== "DRAFT")
        .sort(byName)
    : [];
  const setAdding = (open: boolean) =>
    navigate({ to: "/coach", search: { tab: "muscles", ...(open && { new: true as const }) } });

  if (isPending) return <Loading what="counting the muscles" />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="grid gap-8">
      {adding ? (
        <div className="max-w-2xl">
          <MuscleForm
            key="new"
            onDone={(tag) => navigate({ to: "/coach/muscles/$tag", params: { tag } })}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        user.canAddConcepts && (
          <div>
            <Button size="md" onClick={() => setAdding(true)}>
              + NEW MUSCLE
            </Button>
          </div>
        )
      )}

      <MuscleList
        title={isStaff ? "YOUR OWN MUSCLES" : "YOUR MUSCLES"}
        muscles={yours}
        workloadOf={workloadOf}
        empty={
          user.canAddConcepts
            ? "// none yet: a muscle you add is yours to curate"
            : "// none yet: gym staff add muscles for now"
        }
      />
      {isStaff && (
        <MuscleList
          title="THE GYM'S POOL"
          muscles={gym}
          workloadOf={workloadOf}
          empty="// no other gym muscles"
        />
      )}
      {isStaff && <CommunityList muscles={community} />}
    </div>
  );
}

/** Muscles the user curates, each a row that opens its page, with what waits on it. */
function MuscleList({
  title,
  muscles,
  workloadOf,
  empty,
}: {
  title: string;
  muscles: Concept[];
  workloadOf: (tag: string) => ConceptWorkload | undefined;
  empty: string;
}) {
  return (
    <section>
      <h2 className="font-display text-[9px] text-ink/70">{title}</h2>
      {muscles.length === 0 ? (
        <p className="mt-3 text-xs text-faded">{empty}</p>
      ) : (
        <ul className="pixel-shadow mt-3 divide-y-2 divide-ink/10 border-2 border-line bg-card">
          {muscles.map((concept) => (
            <li key={concept.tag}>
              <Link
                to="/coach/muscles/$tag"
                params={{ tag: concept.tag }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-blue-tint/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{concept.name}</span>
                  <span className="mt-1 flex items-center gap-2 truncate text-[11px] text-faded">
                    #{concept.tag} <KindBadge concept={concept} />
                  </span>
                </span>
                <WorkloadLine workload={workloadOf(concept.tag)} />
                <span aria-hidden="true" className="text-faded">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "54 exercises · 12 to verify · 2 waiting", or "✓ all verified" when nothing waits. */
export function WorkloadLine({ workload }: { workload: ConceptWorkload | undefined }) {
  if (!workload) return null;
  const { questions: exercises, toVerify, waiting } = workload;
  return (
    <span className="flex flex-wrap items-center gap-x-3 text-[11px] font-semibold">
      <span className="text-faded">
        {exercises} exercise{exercises === 1 ? "" : "s"}
      </span>
      {toVerify > 0 && <span className="text-amber-ink">{toVerify} to verify</span>}
      {waiting > 0 && <span className="text-amber-ink">{waiting} waiting</span>}
      {exercises > 0 && toVerify === 0 && waiting === 0 && (
        <span className="text-pixel">✓ all verified</span>
      )}
    </span>
  );
}

/**
 * What kind of muscle it is, as a badge with a tooltip: the gym's (in "all muscles"), the
 * community's (a member's own, trained when picked), or not published (yet, or any more).
 */
export function KindBadge({ concept }: { concept: Concept }) {
  if (concept.status === "DRAFT") {
    return (
      <span title="Not published: only you see it">
        <Badge color="muted">DRAFT</Badge>
      </span>
    );
  }
  if (concept.status === "RETIRED") {
    return (
      <span title="Out of every workout; its exercises and history are kept">
        <Badge color="muted">RETIRED</Badge>
      </span>
    );
  }
  return concept.featured ? (
    <span
      title={
        concept.houseOwned
          ? "One of the gym's own muscles: part of all muscles in workouts, curated by gym staff"
          : "A member's muscle in the gym's pool: part of all muscles, curated by its owner and gym staff"
      }
    >
      <Badge color="blue">GYM</Badge>
    </span>
  ) : (
    <span title="A member's own muscle: trained only when someone picks it; its owner curates it">
      <Badge color="muted">COMMUNITY</Badge>
    </span>
  );
}

/**
 * For staff: members' published muscles, outside the gym's pool. Staff don't curate them; they
 * feature the good ones into the pool, and take down (retire) what mustn't stay up.
 */
function CommunityList({ muscles }: { muscles: Concept[] }) {
  const featureConcept = useFeatureConcept();
  const updateStatus = useUpdateConceptStatus();
  const busy = featureConcept.isPending || updateStatus.isPending;

  return (
    <section>
      <h2 className="font-display text-[9px] text-ink/70">COMMUNITY</h2>
      <p className="mt-1 text-[11px] text-faded">
        // members' own muscles: feature the good ones into the gym's pool; retire what mustn't stay
        up
      </p>
      <ErrorMessage error={featureConcept.error ?? updateStatus.error} />
      {muscles.length === 0 ? (
        <p className="mt-3 text-xs text-faded">// no community muscles yet</p>
      ) : (
        <ul className="pixel-shadow mt-3 divide-y-2 divide-ink/10 border-2 border-line bg-card">
          {muscles.map((concept) => (
            <li key={concept.tag} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{concept.name}</span>
                <span className="mt-1 flex items-center gap-2 truncate text-[11px] text-faded">
                  #{concept.tag} <KindBadge concept={concept} />
                </span>
              </span>
              {concept.status === "ACTIVE" ? (
                <>
                  <SmallAction
                    disabled={busy}
                    onClick={() => featureConcept.mutate({ tag: concept.tag, featured: true })}
                    title="Take it into the gym's pool: part of all muscles, curated by staff too"
                  >
                    FEATURE
                  </SmallAction>
                  <SmallAction
                    disabled={busy}
                    onClick={() => updateStatus.mutate({ tag: concept.tag, status: "RETIRED" })}
                    title="Take it down (moderation); its owner can bring it back"
                  >
                    RETIRE
                  </SmallAction>
                </>
              ) : (
                <SmallAction
                  disabled={busy}
                  onClick={() => updateStatus.mutate({ tag: concept.tag, status: "ACTIVE" })}
                  title="Back on the gym floor"
                >
                  BRING BACK
                </SmallAction>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** An action on a row or a muscle: a small paper button (red for deleting). */
export function SmallAction({
  danger = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return <Button variant={danger ? "danger" : "paper"} size="sm" {...props} />;
}

import type { components, operations } from "./schema";

/**
 * The types the UI works with, derived from the generated schema.d.ts.
 *
 * The generator marks every field optional, because the Java DTOs carry no "required"
 * markers. The API always sends every response field, so responses are made complete
 * here; the few fields that can be null are listed explicitly.
 */

type Schemas = components["schemas"];

/**
 * Which exercises a workout draws from: verified ones, all, or (curators) the ones still to
 * verify.
 */
export type QuestionPool = NonNullable<
  NonNullable<operations["getNextQuestion"]["parameters"]["query"]>["pool"]
>;

type Complete<T, NullableKeys extends keyof T = never> = Omit<Required<T>, NullableKeys> & {
  [K in NullableKeys]-?: Exclude<T[K], undefined> | null;
};

export type User = Complete<Schemas["UserResponse"], "displayName" | "avatarUrl" | "lastLoginAt">;
/** The signed-in user (GET /users/me): a User, plus whether they may add exercises and muscles. */
export type CurrentUser = Complete<
  Schemas["CurrentUserResponse"],
  "displayName" | "avatarUrl" | "lastLoginAt"
>;
/** Who may sign in while sign-in is invite-only (a GitHub username); none means anyone may. */
export type Invite = Complete<Schemas["InviteResponse"]>;
/** The head coach's numbers at the top of the front desk (admins only). */
export type Overview = Complete<Schemas["OverviewResponse"]>;
export type Concept = Complete<Schemas["ConceptResponse"]>;
/** What waits on one muscle the user curates: its live exercises, how many to verify, how many waiting. */
export type ConceptWorkload = Complete<Schemas["ConceptWorkloadResponse"]>;
export type Question = Complete<Schemas["QuestionResponse"], "source">;

/** One page of Coach's Corner's exercises (everyone's for staff), with the totals of all pages. */
export type QuestionPage = Omit<Complete<Schemas["QuestionPageResponse"]>, "items"> & {
  items: Question[];
};

/** A question to train on: no sample solution, which only comes back with the answer. */
export type LearningQuestion = Complete<Schemas["LearningQuestionResponse"], "source" | "myVote">;

/** A learner's answer, with the question as it was when answered (sample solution included). */
export type Answer = Omit<
  Complete<Schemas["AnswerResponse"], "selfGrade" | "perceivedDifficulty">,
  "question"
> & { question: Question };

/** A question waiting for approval on one of the concepts the signed-in user reviews. */
export type Review = Omit<Complete<Schemas["ReviewResponse"]>, "question"> & { question: Question };

/** One page of the questions waiting for approval, with the totals of all pages. */
export type ReviewPage = Omit<Complete<Schemas["ReviewPageResponse"]>, "items"> & {
  items: Review[];
};

/** A learner's report on a question the signed-in user wrote or whose concept they own: open, or decided. */
export type Report = Omit<
  Complete<Schemas["ReportResponse"], "note" | "resolvedAt">,
  "question"
> & {
  question: Question;
};

/** One page of reports, open or decided, with the totals of all pages. */
export type ReportPage = Omit<Complete<Schemas["ReportPageResponse"]>, "items"> & {
  items: Report[];
};

/** The signed-in learner's own open feedback (report) on an exercise, still theirs to change. */
export type MyFeedback = Complete<Schemas["MyReportResponse"], "note">;

export type NewConcept = Schemas["CreateConceptRequest"];
export type NewQuestion = Schemas["CreateQuestionRequest"];
export type ConceptChange = Schemas["UpdateConceptRequest"];
export type QuestionChange = Schemas["UpdateQuestionRequest"];
export type ProfileChange = Schemas["UpdateProfileRequest"];
export type Assessment = Schemas["AssessAnswerRequest"];

export type ConceptStatus = Concept["status"];
export type ContributionPolicy = Concept["contributionPolicy"];
export type QuestionStatus = Question["status"];
export type UserRole = User["role"];
export type UserStatus = User["status"];

/**
 * As the API's rule: staff and admins curate every muscle and exercise (approvals, feedback,
 * edits, benching); members only their own. Only admins manage people.
 */
export function curatesAllContent(role: UserRole): boolean {
  return role === "STAFF" || role === "ADMIN";
}

/** Whether a question is accepted for one of its concepts (never shown to users as such). */
export type ConceptLinkStatus = NonNullable<Schemas["ReviewDecisionRequest"]["status"]>;

/** What a concept owner can decide about a question waiting on their concept. */
export type ReviewDecision = Exclude<ConceptLinkStatus, "PENDING">;

/** Why a learner reports a question: wrong, unclear, duplicate, inappropriate or other. */
export type ReportReason = Report["reason"];

/** What the author or a concept owner can decide about a report: fixed, or nothing to fix. */
export type ReportDecision = Exclude<Report["status"], "OPEN">;

export type Vote = NonNullable<Schemas["VoteRequest"]["vote"]>;

/**
 * Whether the user may verify an exercise on these muscles, as the API decides: on any gym
 * (featured) muscle it's staff's to check; otherwise it's for the owners of its muscles.
 */
export function mayVerify(
  conceptTags: string[],
  concepts: Concept[],
  user: { id: number; role: UserRole },
): boolean {
  const onIt = concepts.filter((concept) => conceptTags.includes(concept.tag));
  return onIt.some((concept) => concept.featured || concept.houseOwned)
    ? curatesAllContent(user.role)
    : onIt.some((concept) => concept.createdBy === user.id);
}

import type { components } from "./schema";

/**
 * The types the UI works with, derived from the generated schema.d.ts.
 *
 * The generator marks every field optional, because the Java DTOs carry no "required"
 * markers. The API always sends every response field, so responses are made complete
 * here; the few fields that can be null are listed explicitly.
 */

type Schemas = components["schemas"];

type Complete<T, NullableKeys extends keyof T = never> = Omit<Required<T>, NullableKeys> & {
  [K in NullableKeys]-?: Exclude<T[K], undefined> | null;
};

export type User = Complete<Schemas["UserResponse"], "displayName" | "avatarUrl" | "lastLoginAt">;
/** The signed-in user (GET /users/me): a User, plus whether they may add exercises and muscles. */
export type CurrentUser = Complete<
  Schemas["CurrentUserResponse"],
  "displayName" | "avatarUrl" | "lastLoginAt"
>;
/** The head coach's numbers at the top of the front desk (admins only). */
export type Overview = Complete<Schemas["OverviewResponse"]>;
export type Concept = Complete<Schemas["ConceptResponse"]>;
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

/** A learner's report on a question the signed-in user wrote or whose concept they own: open, or decided. */
export type Report = Omit<
  Complete<Schemas["ReportResponse"], "note" | "resolvedAt">,
  "question"
> & {
  question: Question;
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
 * As the API's rule: staff and admins curate every muscle and exercise (spot check, reports,
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

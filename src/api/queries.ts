import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, call, signOut } from "./client";
import type {
  Answer,
  Assessment,
  Concept,
  ConceptWorkload,
  ConceptChange,
  ConceptStatus,
  CurrentUser,
  Invite,
  QuestionPool,
  LearningQuestion,
  MyFeedback,
  NewConcept,
  NewQuestion,
  Overview,
  ProfileChange,
  Question,
  QuestionChange,
  QuestionPage,
  QuestionStatus,
  Report,
  ReportDecision,
  ReportPage,
  ReportReason,
  ReviewDecision,
  ReviewPage,
  User,
  UserRole,
  UserStatus,
  Vote,
} from "./types";

/**
 * One hook per API use case. Pages use these hooks and never call the API directly,
 * so caching and "what to refresh after a change" live in one place.
 */

export const queryKeys = {
  currentUser: ["currentUser"],
  users: ["users"],
  // Under users, so a change at the front desk (e.g. a deleted account) refreshes it too.
  overview: ["users", "overview"],
  invites: ["users", "invites"],
  concepts: ["concepts"],
  myQuestions: ["myQuestions"],
  reviews: ["reviews"],
  reports: ["reports"],
  // Under reports, so deciding feedback refreshes it too.
  questionReports: (questionId: number) => ["reports", questionId] as const,
  myAnswers: ["myAnswers"],
  // Under myAnswers, so saving or assessing an answer refreshes these too.
  myAnswersTo: (questionId: number) => ["myAnswers", questionId] as const,
  myFeedbackOn: (questionId: number) => ["myFeedback", questionId] as const,
} as const;

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/** The signed-in user, or null for a visitor. */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: async (): Promise<CurrentUser | null> => {
      try {
        return (await call(api.GET("/users/me"))) as CurrentUser;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: ProfileChange) =>
      (await call(api.PUT("/users/me", { body: change }))) as User,
    onSuccess: (user) => queryClient.setQueryData(queryKeys.currentUser, user),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    // reset (not clear): components already on screen, like the top bar, must re-check too.
    onSuccess: () => queryClient.resetQueries(),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call(api.DELETE("/users/me")),
    // reset (not clear): components already on screen, like the top bar, must re-check too.
    onSuccess: () => queryClient.resetQueries(),
  });
}

// ---------------------------------------------------------------------------
// Front desk: admins manage people (roles, blocking)
// ---------------------------------------------------------------------------

/**
 * The head coach's numbers (admins only): members, this week's newcomers, athletes and sets, open
 * feedback and exercises waiting for approval.
 */
export function useOverview() {
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: async () => (await call(api.GET("/admin/overview"))) as Overview,
  });
}

/** Who may sign in while sign-in is invite-only (admins only); none: anyone may. */
export function useInvites() {
  return useQuery({
    queryKey: queryKeys.invites,
    queryFn: async () => (await call(api.GET("/admin/invites"))) as Invite[],
  });
}

/** Invites a GitHub username: with any invite, only invited accounts (and head coaches) sign in. */
export function useAddInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (login: string) =>
      (await call(api.POST("/admin/invites", { body: { login } }))) as Invite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites }),
  });
}

/** Removes an invite; with none left, anyone may sign in again. */
export function useRemoveInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      call(api.DELETE("/admin/invites/{id}", { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites }),
  });
}

/** Every user (admins only), ordered by id. */
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => (await call(api.GET("/admin/users"))) as User[],
  });
}

/** Makes someone an athlete, gym staff or head coach. They're signed out, to pick it up. */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: UserRole }) =>
      (await call(
        api.PUT("/admin/users/{id}/role", { params: { path: { id: userId } }, body: { role } }),
      )) as User,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

/** Blocks someone (signed out at once, can't sign in) or lets them back in. */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: UserStatus }) =>
      (await call(
        api.PUT("/admin/users/{id}/status", { params: { path: { id: userId } }, body: { status } }),
      )) as User,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

/**
 * Deletes someone's account (admins only), e.g. on an emailed request: as when they delete it
 * themselves; with eraseActivity, their sets, votes and feedback go too.
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, eraseActivity }: { userId: number; eraseActivity: boolean }) =>
      call(
        api.DELETE("/admin/users/{id}", {
          params: { path: { id: userId }, query: { eraseActivity } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export function useConcepts() {
  return useQuery({
    queryKey: queryKeys.concepts,
    queryFn: async () => (await call(api.GET("/content/concepts"))) as Concept[],
  });
}

export function useCreateConcept() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (concept: NewConcept) =>
      (await call(api.POST("/content/concepts", { body: concept }))) as Concept,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.concepts }),
  });
}

/** Edits a concept's name, description, links or contribution policy (owner or admin). */
export function useUpdateConcept() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tag, change }: { tag: string; change: ConceptChange }) =>
      (await call(
        api.PUT("/content/concepts/{tag}", { params: { path: { tag } }, body: change }),
      )) as Concept,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.concepts }),
  });
}

/** Retires a concept or brings it back: retiring is for admins, bringing back also for owners. */
export function useUpdateConceptStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tag, status }: { tag: string; status: ConceptStatus }) =>
      (await call(
        api.PUT("/content/concepts/{tag}/status", { params: { path: { tag } }, body: { status } }),
      )) as Concept,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.concepts }),
  });
}

/** Staff take a published concept into the gym's pool ("all muscles"), or out of it. */
export function useFeatureConcept() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tag, featured }: { tag: string; featured: boolean }) =>
      (await call(
        api.PUT("/content/concepts/{tag}/featured", {
          params: { path: { tag } },
          body: { featured },
        }),
      )) as Concept,
    // Featuring changes who curates the muscle, so the workload too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.concepts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myQuestions }),
      ]),
  });
}

/** Deletes a concept no question uses (drafts by their owner, anything by admins). */
export function useDeleteConcept() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tag: string) =>
      call(api.DELETE("/content/concepts/{tag}", { params: { path: { tag } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.concepts }),
  });
}

/**
 * One exercise, whole, to edit or preview: the signed-in user's own, or any for staff (the API
 * answers 403 or 404 otherwise). Waits while there's no id. Under myQuestions, so every change
 * to a question refreshes it too.
 */
export function useQuestion(id: number | undefined) {
  return useQuery({
    queryKey: [...queryKeys.myQuestions, "one", id],
    queryFn: async () =>
      (await call(
        api.GET("/content/questions/{id}", { params: { path: { id: id as number } } }),
      )) as Question,
    enabled: id !== undefined,
  });
}

/** What Coach's Corner asks for: a zero-based page, optionally of one muscle (`concept`) or title search. */
export type QuestionFilter = {
  concept?: string;
  search?: string;
  /** Staff outside reviewer mode: only their own, as a member sees it. */
  asMember?: boolean;
  page: number;
  size: number;
};

/**
 * One page of the exercises in Coach's Corner, newest first: the signed-in user's own, the gym's
 * pool for staff, and every exercise on a filtered muscle the user curates. Under myQuestions, so
 * every change to a question refreshes it too; the previous page stays on screen while the next
 * one loads.
 */
export function useCuratedQuestions(filter: QuestionFilter) {
  return useQuery({
    queryKey: [...queryKeys.myQuestions, "page", filter],
    queryFn: async () =>
      (await call(api.GET("/content/questions", { params: { query: filter } }))) as QuestionPage,
    placeholderData: keepPreviousData,
  });
}

/**
 * For each muscle the user curates (their own, and the gym's pool for staff): its exercises, how
 * many to verify, how many waiting. Under myQuestions, so every change to an exercise refreshes it.
 */
export function useConceptWorkload() {
  return useQuery({
    queryKey: [...queryKeys.myQuestions, "workload"],
    queryFn: async () => (await call(api.GET("/content/concepts/workload"))) as ConceptWorkload[],
  });
}

export function useSubmitQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (question: NewQuestion) =>
      (await call(api.POST("/content/questions", { body: question }))) as Question,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myQuestions }),
  });
}

/** Edits a question (author or admin); its status and existing concept decisions are kept. */
export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change }: { id: number; change: QuestionChange }) =>
      (await call(
        api.PUT("/content/questions/{id}", { params: { path: { id } }, body: change }),
      )) as Question,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myQuestions });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews });
    },
  });
}

/** Retires a question or brings it back (admins only). */
export function useUpdateQuestionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: QuestionStatus }) =>
      (await call(
        api.PUT("/content/questions/{id}/status", { params: { path: { id } }, body: { status } }),
      )) as Question,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myQuestions }),
  });
}

/** Deletes a question nobody has answered yet (drafts by their author, anything by admins). */
export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      call(api.DELETE("/content/questions/{id}", { params: { path: { id } } })),
    // Deleting a question deletes its feedback too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.myQuestions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
      ]),
  });
}

// ---------------------------------------------------------------------------
// Reviews: concept owners (and admins) accept or decline contributed questions
// ---------------------------------------------------------------------------

export type ReviewFilter = {
  page: number;
  size: number;
};

/** One page of the questions waiting for the signed-in user's approval, oldest first. */
export function useReviews(filter: ReviewFilter, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.reviews, filter],
    queryFn: async () =>
      (await call(api.GET("/content/reviews", { params: { query: filter } }))) as ReviewPage,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Verifies an exercise (checked: a clear question, a correct answer), or takes it back. */
export function useVerifyExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, verified }: { questionId: number; verified: boolean }) =>
      call(
        api.PUT("/content/questions/{id}/verification", {
          params: { path: { id: questionId } },
          body: { verified },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myQuestions }),
  });
}

export function useReviewQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      conceptTag,
      decision,
    }: {
      questionId: number;
      conceptTag: string;
      decision: ReviewDecision;
    }) =>
      call(
        api.PUT("/content/questions/{id}/concepts/{tag}/review", {
          params: { path: { id: questionId, tag: conceptTag } },
          body: { status: decision },
        }),
      ),
    // A decision changes the muscle's lists and counts too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myQuestions }),
      ]),
  });
}

// ---------------------------------------------------------------------------
// Reports: learners flag questions; their author or a concept owner decides
// ---------------------------------------------------------------------------

export type ReportFilter = {
  /** The decided ones (resolved or dismissed), newest decision first, instead of the open ones. */
  decided?: boolean;
  /** Staff outside reviewer mode: only feedback on their own exercises, as a member sees it. */
  asMember?: boolean;
  page: number;
  size: number;
};

/**
 * One page of the reports on the signed-in user's questions and concepts (all, for staff): open
 * ones oldest first, or the decided ones, the FEEDBACK history.
 */
export function useReports(filter: ReportFilter) {
  return useQuery({
    queryKey: [...queryKeys.reports, "page", filter],
    queryFn: async () =>
      (await call(api.GET("/content/reports", { params: { query: filter } }))) as ReportPage,
    placeholderData: keepPreviousData,
  });
}

/**
 * Every piece of feedback on one exercise, for its author or staff: open first (oldest first),
 * then decided (newest decision first).
 */
export function useQuestionReports(questionId: number) {
  return useQuery({
    queryKey: queryKeys.questionReports(questionId),
    queryFn: async () =>
      (await call(
        api.GET("/content/questions/{id}/reports", { params: { path: { id: questionId } } }),
      )) as Report[],
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, decision }: { reportId: number; decision: ReportDecision }) =>
      call(
        api.PUT("/content/reports/{id}", {
          params: { path: { id: reportId } },
          body: { status: decision },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
  });
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

/**
 * Asks for the next exercise: new ones first, then done ones at random, the longer ago the
 * likelier. `skip` holds
 * the exercises already seen in this workout, so a workout never repeats one. Resolves to null
 * when nothing is left. A mutation, not a query: the workout asks at moments it chooses (start,
 * SWAP, NEXT), and changing the picked muscles must not replace the current exercise.
 */
/**
 * One chosen exercise to train, e.g. retried from past workouts; its count of new exercises is for
 * the workout's muscles. The API answers 404 for one that's out of workouts (benched) since.
 */
export function useChosenExercise() {
  return useMutation({
    mutationFn: async ({
      id,
      concepts,
      pool,
    }: {
      id: number;
      concepts: string[];
      /** Only the count of new exercises depends on it: a chosen exercise is shown either way. */
      pool: QuestionPool;
    }) =>
      (await call(
        api.GET("/learning/questions/{id}", {
          params: {
            path: { id },
            query: { ...(concepts.length > 0 && { concepts }), pool },
          },
        }),
      )) as LearningQuestion,
  });
}

export function useNextExercise() {
  return useMutation({
    mutationFn: async ({
      concepts,
      skip,
      pool,
    }: {
      concepts: string[];
      skip: number[];
      /** Which exercises to draw from (useWorkoutPool). */
      pool: QuestionPool;
    }) =>
      ((await call(
        api.GET("/learning/questions/next", {
          params: {
            query: {
              ...(concepts.length > 0 && { concepts }),
              ...(skip.length > 0 && { skip }),
              pool,
            },
          },
        }),
      )) as LearningQuestion | undefined) ?? null, // 204: nothing left
  });
}

/**
 * REVIEW on the rack: a curator reads the whole exercise, model answer included, without
 * answering it (whoever may verify it may read it). Nothing is saved.
 */
export function useReviewExercise() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await call(api.GET("/content/questions/{id}", { params: { path: { id } } }))) as Question,
  });
}

/** Stores the learner's answer; the result carries the model answer to reveal. */
export function useSubmitAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: number; answer: string }) =>
      (await call(api.POST("/learning/answers", { body: { questionId, answer } }))) as Answer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myAnswers }),
  });
}

/** The learner's optional self-assessment of an answer. */
export function useAssessAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ answerId, assessment }: { answerId: number; assessment: Assessment }) =>
      (await call(
        api.PUT("/learning/answers/{id}/assessment", {
          params: { path: { id: answerId } },
          body: assessment,
        }),
      )) as Answer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myAnswers }),
  });
}

type FeedbackInput = { questionId: number; reason: ReportReason; note?: string };

/**
 * Sends feedback on an exercise: praise, or a problem (wrong, unclear, a duplicate,
 * inappropriate or other). One open piece per learner and exercise, until it's decided.
 */
export function useReportExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, reason, note }: FeedbackInput) =>
      call(
        api.POST("/learning/questions/{id}/reports", {
          params: { path: { id: questionId } },
          body: { reason, note },
        }),
      ),
    onSuccess: (_, { questionId }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.myFeedbackOn(questionId) }),
  });
}

/** The learner's own open feedback on an exercise, or null when they have none open. */
export function useMyFeedback(questionId: number) {
  return useQuery({
    queryKey: queryKeys.myFeedbackOn(questionId),
    queryFn: async () =>
      ((await call(
        api.GET("/learning/questions/{id}/reports/mine", { params: { path: { id: questionId } } }),
      )) as MyFeedback | undefined) ?? null, // 204: none open
  });
}

/** Changes what the learner's open feedback on an exercise says. */
export function useUpdateMyFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, reason, note }: FeedbackInput) =>
      (await call(
        api.PUT("/learning/questions/{id}/reports/mine", {
          params: { path: { id: questionId } },
          body: { reason, note },
        }),
      )) as MyFeedback,
    onSuccess: (feedback, { questionId }) =>
      queryClient.setQueryData(queryKeys.myFeedbackOn(questionId), feedback),
  });
}

/** Withdraws the learner's open feedback on an exercise, as if it was never sent. */
export function useWithdrawMyFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: number) =>
      call(
        api.DELETE("/learning/questions/{id}/reports/mine", {
          params: { path: { id: questionId } },
        }),
      ),
    onSuccess: (_, questionId) =>
      queryClient.setQueryData(queryKeys.myFeedbackOn(questionId), null),
  });
}

/** The learner's thumbs up or down on an exercise; null takes the vote back. */
export function useVoteOnExercise() {
  return useMutation({
    mutationFn: ({ questionId, vote }: { questionId: number; vote: Vote | null }) =>
      vote
        ? call(
            api.PUT("/learning/questions/{id}/vote", {
              params: { path: { id: questionId } },
              body: { vote },
            }),
          )
        : call(
            api.DELETE("/learning/questions/{id}/vote", { params: { path: { id: questionId } } }),
          ),
  });
}

/**
 * The signed-in user's answers, newest first: their workout history. `signedIn: false` (a
 * visitor) skips the call: a visitor has no sets.
 */
export function useMyAnswers(signedIn = true) {
  return useQuery({
    queryKey: queryKeys.myAnswers,
    enabled: signedIn,
    queryFn: async () => (await call(api.GET("/learning/answers"))) as Answer[],
  });
}

/**
 * The signed-in user's earlier answers to one exercise, newest first: their previous sets.
 * `signedIn: false` (a visitor) skips the call: a visitor has no sets.
 */
export function usePreviousSets(questionId: number, signedIn = true) {
  return useQuery({
    queryKey: queryKeys.myAnswersTo(questionId),
    enabled: signedIn,
    queryFn: async () =>
      (await call(api.GET("/learning/answers", { params: { query: { questionId } } }))) as Answer[],
  });
}

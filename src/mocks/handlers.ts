import { http, HttpResponse } from "msw";
import { API_URL } from "@/api/client";
import { curatesAllContent } from "@/api/types";
import type {
  Answer,
  Assessment,
  Concept,
  ConceptChange,
  ConceptLinkStatus,
  ConceptStatus,
  Invite,
  LearningQuestion,
  NewConcept,
  NewQuestion,
  ProfileChange,
  Question,
  QuestionChange,
  QuestionStatus,
  Report,
  ReportReason,
  Review,
  UserRole,
  UserStatus,
  Vote,
} from "@/api/types";
import {
  mockAnswers,
  mockConcepts,
  mockMembers,
  mockQuestions,
  mockReports,
  mockUser,
} from "./data";

/**
 * A pretend API for mock mode. It answers the same URLs as the Spring Boot API, with the same
 * rules, so the app runs unchanged. State lives in memory (a reload resets it), except
 * "signed in", which is kept in localStorage so signing out and in again survives reloads.
 */

const SIGNED_OUT_KEY = "hs-mock-signed-out";

export function isSignedIn(): boolean {
  return localStorage.getItem(SIGNED_OUT_KEY) === null;
}

export function setSignedIn(signedIn: boolean): void {
  if (signedIn) {
    localStorage.removeItem(SIGNED_OUT_KEY);
  } else {
    localStorage.setItem(SIGNED_OUT_KEY, "true");
  }
}

const user = { ...mockUser };
const members = mockMembers.map((member) => ({ ...member }));
const concepts = [...mockConcepts];
const questions = [...mockQuestions];
const answers = [...mockAnswers];
const reports = [...mockReports];
// Mock mode starts open: no invites, so anyone signs in.
const invites: Invite[] = [];
let nextInviteId = 1;
/** mock_coach's own reports (feedback), report id by question id: one open per athlete, as the API allows. */
const reportedByMe = new Map<number, number>();

/** mock_coach's open report on the question, if any. */
function myOpenReport(questionId: number): Report | undefined {
  const reportId = reportedByMe.get(questionId);
  return reports.find((report) => report.id === reportId && report.status === "OPEN");
}

function noOpenFeedback(questionId: unknown) {
  return HttpResponse.json(
    { message: `You have no open feedback on question ${questionId}` },
    { status: 404 },
  );
}

/** A report as its author sees it: without the question. */
function asMyFeedback({ question: _question, ...feedback }: Report) {
  return feedback;
}
/** mock_coach's own votes, by question id. */
const myVotes = new Map<number, Vote>();

// ---------------------------------------------------------------------------
// The API's rules
// ---------------------------------------------------------------------------

/** Decisions on question-concept links, keyed "questionId:tag"; missing = the starting state. */
const linkDecisions = new Map<string, ConceptLinkStatus>();

/**
 * As the API: a link waits when the concept's owner approves contributions and its author
 * doesn't curate the concept (isn't its owner, or staff).
 */
function linkStatus(question: Question, tag: string): ConceptLinkStatus {
  const decided = linkDecisions.get(`${question.id}:${tag}`);
  if (decided) return decided;
  const concept = concepts.find((candidate) => candidate.tag === tag);
  const author =
    question.createdBy === user.id ? user : members.find((m) => m.id === question.createdBy);
  const authorCurates =
    concept?.createdBy === question.createdBy ||
    (author !== undefined && curatesAllContent(author.role));
  return concept?.contributionPolicy === "OWNER_APPROVAL" && !authorCurates
    ? "PENDING"
    : "ACCEPTED";
}

/** The concepts a question is shown for: accepted, and published. */
function acceptedTags(question: Question): string[] {
  return question.conceptTags.filter(
    (tag) =>
      linkStatus(question, tag) === "ACCEPTED" &&
      concepts.some((concept) => concept.tag === tag && concept.status === "ACTIVE"),
  );
}

/** As the API: three open reports hold a question back until they are decided. */
function heldBack(question: Question): boolean {
  return (
    reports.filter((report) => report.question.id === question.id && report.status === "OPEN")
      .length >= 3
  );
}

function availableForLearning(question: Question): boolean {
  return (
    question.status === "SUBMITTED" && acceptedTags(question).length > 0 && !heldBack(question)
  );
}

/** Whether the muscle is in the gym's pool: what "all muscles" (nothing picked) trains. */
function isFeatured(tag: string): boolean {
  return concepts.some((concept) => concept.tag === tag && concept.featured);
}

/**
 * Like the API: whether mock_coach may verify the question: staff's to check when it's on any gym
 * (featured) muscle; otherwise its muscles' owners'.
 */
function canVerify(question: Question): boolean {
  if (!isSignedIn()) return false;
  const onIt = concepts.filter((concept) => question.conceptTags.includes(concept.tag));
  return onIt.some((concept) => concept.featured)
    ? curatesAllContent(user.role)
    : onIt.some((concept) => concept.createdBy === user.id);
}

/** The question with mock_coach's own vote added to the others'. */
function withMyVote(question: Question): Question {
  const vote = myVotes.get(question.id);
  return {
    ...question,
    upVotes: question.upVotes + (vote === "UP" ? 1 : 0),
    downVotes: question.downVotes + (vote === "DOWN" ? 1 : 0),
  };
}

/** As the API: the question's author, the owner of a muscle it's on, or staff decide a report. */
/** asMember: staff outside reviewer mode, seeing what a member sees. */
function canDecide(report: Report, asMember = false): boolean {
  return (
    (curatesAllContent(user.role) && !asMember) ||
    report.question.createdBy === user.id ||
    report.question.conceptTags.some(
      (tag) => concepts.find((concept) => concept.tag === tag)?.createdBy === user.id,
    )
  );
}

/** Picks one item at random, each as likely as its weight (a roulette wheel). */
function weightedPick<T>(items: T[], weightOf: (item: T) => number): T | undefined {
  let ticket = Math.random() * items.reduce((total, item) => total + weightOf(item), 0);
  return items.find((item) => (ticket -= weightOf(item)) < 0) ?? items.at(-1);
}

function reviewsFor(): Review[] {
  return questions
    .filter((question) => question.status === "SUBMITTED")
    .flatMap((question) =>
      question.conceptTags
        .filter((tag) => linkStatus(question, tag) === "PENDING")
        // As the API: on the user's own muscles, and for staff on the gym's pool too.
        .filter((tag) => {
          const concept = concepts.find((candidate) => candidate.tag === tag);
          return (
            concept?.createdBy === user.id || (curatesAllContent(user.role) && !!concept?.featured)
          );
        })
        .map((conceptTag) => ({ conceptTag, question })),
    );
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const url = (path: string) => `${API_URL}${path}`;

/** As the API's QuestionPool: verified ones, all, or the unverified ones the athlete may verify. */
function inPool(question: Question, pool: string): boolean {
  if (pool === "VERIFIED") return question.verified;
  if (pool === "TO_VERIFY") return isSignedIn() && !question.verified && canVerify(question);
  return true;
}

/** As the API's paged lists: ?page (from 0) and ?size, with the totals across every page. */
function pageOf<T>(items: T[], request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 0);
  const size = Number(params.get("size") ?? 20);
  return {
    items: items.slice(page * size, (page + 1) * size),
    page,
    size,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}
const signInRequired = () => HttpResponse.json({ message: "Sign in required" }, { status: 401 });
const forbidden = (message: string) => HttpResponse.json({ message }, { status: 403 });
const conceptNotFound = (tag: unknown) =>
  HttpResponse.json({ message: `Concept with tag '${tag}' not found` }, { status: 404 });
const questionNotFound = (id: unknown) =>
  HttpResponse.json({ message: `Question with id '${id}' not found` }, { status: 404 });
const now = () => new Date().toISOString();

/** As the API: content can be changed by whoever wrote it, and by staff. */
const canModify = (authorId: number) => curatesAllContent(user.role) || authorId === user.id;

export const handlers = [
  http.get(url("/csrf"), () => HttpResponse.json({ headerName: "X-CSRF-TOKEN", token: "mock" })),

  http.post(url("/logout"), () => {
    setSignedIn(false);
    return new HttpResponse(null, { status: 204 });
  }),

  // Account

  // As the API with its launch setting: only staff (head coaches included) add exercises and muscles.
  http.get(url("/users/me"), () =>
    isSignedIn()
      ? HttpResponse.json({
          ...user,
          // As at launch: members add exercises, only staff add muscles.
          canAddQuestions: true,
          canAddConcepts: user.role !== "MEMBER",
        })
      : signInRequired(),
  ),

  // Front desk (admins only, as the API)

  http.get(url("/admin/users"), () => {
    if (!isSignedIn()) return signInRequired();
    if (user.role !== "ADMIN") return forbidden("Access denied");
    return HttpResponse.json([user, ...members]);
  }),

  // As the API: invites sorted by username; a username is invited once, in any case.
  http.get(url("/admin/invites"), () => {
    if (!isSignedIn()) return signInRequired();
    if (user.role !== "ADMIN") return forbidden("Access denied");
    return HttpResponse.json(
      [...invites].sort((a, b) => a.login.toLowerCase().localeCompare(b.login.toLowerCase())),
    );
  }),

  http.post(url("/admin/invites"), async ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    if (user.role !== "ADMIN") return forbidden("Access denied");
    const login = ((await request.json()) as { login?: string }).login?.trim() ?? "";
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(login)) {
      return HttpResponse.json(
        { message: login ? "login must be a GitHub username" : "login must not be blank" },
        { status: 400 },
      );
    }
    if (invites.some((invite) => invite.login.toLowerCase() === login.toLowerCase())) {
      return HttpResponse.json(
        { message: `GitHub account '${login}' is already invited` },
        { status: 409 },
      );
    }
    const invite: Invite = { id: nextInviteId++, provider: "GITHUB", login, invitedAt: now() };
    invites.push(invite);
    return HttpResponse.json(invite, { status: 201 });
  }),

  http.delete(url("/admin/invites/:id"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    if (user.role !== "ADMIN") return forbidden("Access denied");
    const index = invites.findIndex((invite) => invite.id === Number(params.id));
    if (index < 0) {
      return HttpResponse.json(
        { message: `Invite with id '${params.id}' not found` },
        { status: 404 },
      );
    }
    invites.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // As the API: people without deleted accounts (mock mode has no house account), "this week" = the
  // last 7 days, a question waiting on several muscles counted once. Every mock set is mock_coach's.
  http.get(url("/admin/overview"), () => {
    if (!isSignedIn()) return signInRequired();
    if (user.role !== "ADMIN") return forbidden("Access denied");
    const weekAgo = Date.now() - 7 * 86_400_000;
    const thisWeek = (iso: string | null) => iso !== null && Date.parse(iso) >= weekAgo;
    const people = [user, ...members].filter((person) => person.status !== "DELETED");
    const setsThisWeek = answers.filter((answer) => thisWeek(answer.answeredAt));
    return HttpResponse.json({
      users: people.length,
      newUsersThisWeek: people.filter((person) => thisWeek(person.createdAt)).length,
      activeUsersThisWeek: setsThisWeek.length > 0 ? 1 : 0,
      answersThisWeek: setsThisWeek.length,
      openReports: reports.filter((report) => report.status === "OPEN").length,
      questionsAwaitingReview: new Set(reviewsFor().map((review) => review.question.id)).size,
    });
  }),

  http.put(url("/admin/users/:id/:field"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    if (user.role !== "ADMIN") return forbidden("Access denied");
    const member = members.find((candidate) => candidate.id === Number(params.id));
    if (!member) {
      return HttpResponse.json(
        { message: `User with id '${params.id}' not found` },
        { status: 404 },
      );
    }
    const change = (await request.json()) as { role?: UserRole; status?: UserStatus };
    // As the API: admins come only from the configuration, never from the front desk.
    if (params.field === "role" && change.role === "ADMIN") {
      return HttpResponse.json(
        { message: "role must be MEMBER or STAFF: admins are set in the configuration" },
        { status: 400 },
      );
    }
    if (params.field === "role" && member.role === "ADMIN") {
      return HttpResponse.json(
        {
          message: `User '${member.id}' is an admin: admins are set in the configuration, not in the app`,
        },
        { status: 409 },
      );
    }
    if (params.field === "role" && change.role) member.role = change.role;
    if (params.field === "status" && change.status) member.status = change.status;
    return HttpResponse.json(member);
  }),

  // As the API: the same soft delete as deleting one's own account; the house account can't be.
  http.delete(url("/admin/users/:id"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    if (user.role !== "ADMIN") return forbidden("Access denied");
    const member = members.find((candidate) => candidate.id === Number(params.id));
    if (!member) {
      return HttpResponse.json(
        { message: `User with id '${params.id}' not found` },
        { status: 404 },
      );
    }
    Object.assign(member, { status: "DELETED", displayName: null, avatarUrl: null });
    return new HttpResponse(null, { status: 204 });
  }),

  http.put(url("/users/me"), async ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    const change = (await request.json()) as ProfileChange;
    user.displayName = change.displayName ?? user.displayName;
    return HttpResponse.json(user);
  }),

  http.delete(url("/users/me"), () => {
    setSignedIn(false);
    return new HttpResponse(null, { status: 204 });
  }),

  // Content

  // As the API: for each muscle the mock user curates, its live exercises, the ones to verify,
  // and the ones waiting for approval.
  http.get(url("/content/concepts/workload"), () => {
    if (!isSignedIn()) return signInRequired();
    return HttpResponse.json(
      concepts
        .filter(
          (concept) =>
            concept.createdBy === user.id || (curatesAllContent(user.role) && concept.featured),
        )
        .map((concept) => {
          const live = questions.filter(
            (question) =>
              question.status === "SUBMITTED" && question.conceptTags.includes(concept.tag),
          );
          const accepted = live.filter((question) => acceptedTags(question).includes(concept.tag));
          return {
            tag: concept.tag,
            questions: accepted.length,
            toVerify: accepted.filter((question) => !question.verified).length,
            waiting: live.length - accepted.length,
          };
        }),
    );
  }),

  // Open to visitors, as the API: drafts only for their owner and staff.
  http.get(url("/content/concepts"), () =>
    HttpResponse.json(
      concepts.filter(
        (concept) =>
          concept.status !== "DRAFT" ||
          (isSignedIn() && (curatesAllContent(user.role) || concept.createdBy === user.id)),
      ),
    ),
  ),

  http.post(url("/content/concepts"), async ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    const input = (await request.json()) as NewConcept;
    if (concepts.some((existing) => existing.tag === input.tag)) {
      return HttpResponse.json(
        { message: `Concept with tag '${input.tag}' already exists` },
        { status: 409 },
      );
    }
    const created: Concept = {
      tag: input.tag ?? "",
      name: input.name ?? "",
      description: input.description ?? "",
      externalReferences: input.externalReferences ?? [],
      status: "ACTIVE",
      featured: false,
      houseOwned: false,
      contributionPolicy: input.contributionPolicy ?? "AUTO_ACCEPT",
      createdBy: user.id,
      updatedBy: user.id,
      createdAt: now(),
      updatedAt: now(),
    };
    concepts.push(created);
    concepts.sort((a, b) => a.tag.localeCompare(b.tag));
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(url("/content/concepts/:tag"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const concept = concepts.find((candidate) => candidate.tag === params.tag);
    if (!concept) return conceptNotFound(params.tag);
    if (!canModify(concept.createdBy))
      return forbidden(`Only the owner of concept '${concept.tag}' may change it`);
    const change = (await request.json()) as ConceptChange;
    concept.name = change.name ?? concept.name;
    concept.description = change.description ?? concept.description;
    concept.externalReferences = change.externalReferences ?? concept.externalReferences;
    // As the API: leaving the policy out keeps the current one.
    concept.contributionPolicy = change.contributionPolicy ?? concept.contributionPolicy;
    concept.updatedBy = user.id;
    concept.updatedAt = now();
    return HttpResponse.json(concept);
  }),

  http.put(url("/content/concepts/:tag/status"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const concept = concepts.find((candidate) => candidate.tag === params.tag);
    if (!concept) return conceptNotFound(params.tag);
    if (!canModify(concept.createdBy))
      return forbidden(`Only the owner of concept '${concept.tag}' may change it`);
    const { status } = (await request.json()) as { status: ConceptStatus };
    // As the API: a featured muscle stays published until it's unfeatured.
    if (status !== "ACTIVE" && concept.featured) {
      return HttpResponse.json(
        { message: `Concept '${concept.tag}' is featured in the gym's pool: unfeature it first` },
        { status: 409 },
      );
    }
    concept.status = status;
    concept.updatedAt = now();
    return HttpResponse.json(concept);
  }),

  // As the API: staff take a published muscle into the gym's pool, or out again.
  http.put(url("/content/concepts/:tag/featured"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const concept = concepts.find((candidate) => candidate.tag === params.tag);
    if (!concept) return conceptNotFound(params.tag);
    if (!curatesAllContent(user.role)) return forbidden("Only staff may feature a concept");
    const { featured } = (await request.json()) as { featured: boolean };
    // As the API: the gym's own muscles always stay in its pool.
    if (!featured && concept.houseOwned) {
      return HttpResponse.json(
        { message: `Concept '${concept.tag}' is one of the gym's own: it stays in the gym's pool` },
        { status: 409 },
      );
    }
    if (featured && concept.status !== "ACTIVE") {
      return HttpResponse.json(
        { message: `Concept '${concept.tag}' isn't published, so it can't be featured` },
        { status: 409 },
      );
    }
    concept.featured = featured;
    concept.updatedAt = now();
    return HttpResponse.json(concept);
  }),

  http.delete(url("/content/concepts/:tag"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    const concept = concepts.find((candidate) => candidate.tag === params.tag);
    if (!concept) return conceptNotFound(params.tag);
    if (!canModify(concept.createdBy))
      return forbidden(`Only the owner of concept '${concept.tag}' may change it`);
    if (!curatesAllContent(user.role) && concept.status !== "DRAFT") {
      return forbidden("Only staff may delete a published concept");
    }
    if (questions.some((question) => question.conceptTags.includes(concept.tag))) {
      return HttpResponse.json(
        { message: `Concept with tag '${concept.tag}' is used by at least one question` },
        { status: 409 },
      );
    }
    concepts.splice(concepts.indexOf(concept), 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // As the API: the caller's own, everyone's for staff, and every exercise on a filtered muscle
  // the caller curates; the muscle may be any of the exercise's, the search is part of the title
  // in any case; newest first, pages of 1 to 100.
  http.get(url("/content/questions"), ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    const query = new URL(request.url).searchParams;
    const muscle = query.get("concept")?.trim();
    const search = query.get("search")?.trim().toLowerCase();
    const page = Number(query.get("page") ?? 0);
    const size = Number(query.get("size") ?? 20);
    if (size < 1 || size > 100) {
      return HttpResponse.json({ message: "size must be between 1 and 100" }, { status: 400 });
    }
    // A muscle the user curates: the mock user's own, or any featured one for staff.
    const curatesTag = (tag: string) =>
      concepts.some(
        (concept) =>
          concept.tag === tag &&
          (concept.createdBy === user.id || (curatesAllContent(user.role) && concept.featured)),
      );
    const matching = questions
      .filter(
        (question) =>
          (curatesAllContent(user.role) && query.get("asMember") !== "true") ||
          question.createdBy === user.id ||
          (!!muscle && curatesTag(muscle) && question.conceptTags.includes(muscle)),
      )
      .filter((question) => !muscle || question.conceptTags.includes(muscle))
      .filter((question) => !search || question.title.toLowerCase().includes(search))
      .reverse();
    return HttpResponse.json({
      items: matching.slice(page * size, (page + 1) * size).map(withMyVote),
      page,
      size,
      totalItems: matching.length,
      totalPages: Math.ceil(matching.length / size),
    });
  }),

  http.post(url("/content/questions"), async ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    const input = (await request.json()) as NewQuestion;
    if (!input.title?.trim()) {
      return HttpResponse.json({ message: "title is required" }, { status: 400 });
    }
    const created: Question = {
      id: Math.max(0, ...questions.map((question) => question.id)) + 1,
      title: input.title,
      requirement: input.requirement ?? "",
      sampleSolution: input.sampleSolution ?? "",
      difficultyScore: input.difficultyScore ?? 1,
      source: input.source ?? null,
      verified: false,
      conceptTags: [...new Set(input.conceptTags ?? [])],
      status: "SUBMITTED",
      createdBy: user.id,
      updatedBy: user.id,
      createdAt: now(),
      updatedAt: now(),
      upVotes: 0,
      downVotes: 0,
    };
    questions.push(created);
    // Freeze the starting state of each link, as the API stores it.
    for (const tag of created.conceptTags) {
      linkDecisions.set(`${created.id}:${tag}`, linkStatus(created, tag));
    }
    return HttpResponse.json(created, { status: 201 });
  }),

  // As the API: the author, or staff, may read one question whole (to edit or preview it).
  http.get(url("/content/questions/:id"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question) return questionNotFound(params.id);
    // As the API: whoever may change it, or verify it (to review it first).
    if (!canModify(question.createdBy) && !canVerify(question))
      return forbidden(`Only the author of question '${question.id}' may change it`);
    return HttpResponse.json(withMyVote(question));
  }),

  http.put(url("/content/questions/:id"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question) return questionNotFound(params.id);
    if (!canModify(question.createdBy))
      return forbidden(`Only the author of question '${question.id}' may change it`);
    const change = (await request.json()) as QuestionChange;
    const tags = [...new Set(change.conceptTags ?? [])];
    if (!change.title?.trim()) {
      return HttpResponse.json({ message: "title is required" }, { status: 400 });
    }
    if (tags.length === 0) {
      return HttpResponse.json({ message: "conceptTags is required" }, { status: 400 });
    }
    Object.assign(question, {
      title: change.title,
      requirement: change.requirement ?? question.requirement,
      sampleSolution: change.sampleSolution ?? question.sampleSolution,
      difficultyScore: change.difficultyScore ?? question.difficultyScore,
      source: change.source ?? null,
      conceptTags: tags,
      updatedBy: user.id,
      updatedAt: now(),
    });
    // As the API: existing links keep their decision; new ones start as on submit.
    for (const tag of tags) {
      const key = `${question.id}:${tag}`;
      if (!linkDecisions.has(key)) linkDecisions.set(key, linkStatus(question, tag));
    }
    return HttpResponse.json(question);
  }),

  http.put(url("/content/questions/:id/status"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question) return questionNotFound(params.id);
    if (!curatesAllContent(user.role))
      return forbidden("Only staff may change the status of a question");
    const { status } = (await request.json()) as { status: QuestionStatus };
    question.status = status;
    question.updatedAt = now();
    return HttpResponse.json(question);
  }),

  http.delete(url("/content/questions/:id"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question) return questionNotFound(params.id);
    if (!canModify(question.createdBy))
      return forbidden(`Only the author of question '${question.id}' may change it`);
    if (!curatesAllContent(user.role)) {
      return forbidden("Only staff may delete a question");
    }
    if (answers.some((answer) => answer.questionId === question.id)) {
      return HttpResponse.json(
        { message: `Question with id '${question.id}' has answers: retire it instead` },
        { status: 409 },
      );
    }
    // As the API: its feedback goes with it.
    reports.splice(
      0,
      reports.length,
      ...reports.filter((report) => report.question.id !== question.id),
    );
    questions.splice(questions.indexOf(question), 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // As the API: every report on one question, for its author or staff; open ones first (oldest
  // first), then decided ones (newest decision first).
  http.get(url("/content/questions/:id/reports"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question) return questionNotFound(params.id);
    if (!canModify(question.createdBy))
      return forbidden(`Only the author of question '${question.id}' may change it`);
    const own = reports.filter((report) => report.question.id === question.id);
    return HttpResponse.json([
      ...own
        .filter((report) => report.status === "OPEN")
        .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt)),
      ...own
        .filter((report) => report.status !== "OPEN")
        .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "")),
    ]);
  }),

  // Reviews

  // As the API: oldest first, a page at a time.
  http.get(url("/content/reviews"), ({ request }) =>
    isSignedIn() ? HttpResponse.json(pageOf(reviewsFor(), request)) : signInRequired(),
  ),

  http.put(url("/content/questions/:id/concepts/:tag/review"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const { status } = (await request.json()) as { status?: ConceptLinkStatus };
    if (status !== "ACCEPTED" && status !== "DECLINED") {
      return HttpResponse.json({ message: "status must be ACCEPTED or DECLINED" }, { status: 400 });
    }
    linkDecisions.set(`${params.id}:${params.tag}`, status);
    return new HttpResponse(null, { status: 204 });
  }),

  // As the API: whoever curates it verifies a question accepted somewhere, or takes it back.
  http.put(url("/content/questions/:id/verification"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question) return HttpResponse.json({ message: "not found" }, { status: 404 });
    if (!canVerify(question)) return forbidden("Only whoever curates it may verify it");
    const { verified } = (await request.json()) as { verified?: boolean };
    if (verified && acceptedTags(question).length === 0) {
      return HttpResponse.json(
        { message: "not accepted for any muscle yet, so it can't be verified" },
        { status: 409 },
      );
    }
    question.verified = !!verified;
    return new HttpResponse(null, { status: 204 });
  }),

  // Reports

  // As the API: open feedback, oldest first; with decided=true, the decided ones, newest decision first.
  http.get(url("/content/reports"), ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    const params = new URL(request.url).searchParams;
    const decided = params.get("decided") === "true";
    const visible = reports.filter((report) =>
      canDecide(report, params.get("asMember") === "true"),
    );
    return HttpResponse.json(
      pageOf(
        decided
          ? visible
              .filter((report) => report.status !== "OPEN")
              .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""))
          : visible.filter((report) => report.status === "OPEN"),
        request,
      ),
    );
  }),

  http.put(url("/content/reports/:id"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const report = reports.find((candidate) => candidate.id === Number(params.id));
    if (!report) {
      return HttpResponse.json(
        { message: `Report with id '${params.id}' not found` },
        { status: 404 },
      );
    }
    if (!canDecide(report)) {
      return forbidden(
        `Only the question's author or a concept owner may decide report '${report.id}'`,
      );
    }
    const { status } = (await request.json()) as { status?: Report["status"] };
    if (status !== "RESOLVED" && status !== "DISMISSED") {
      return HttpResponse.json(
        { message: "status must be RESOLVED or DISMISSED" },
        { status: 400 },
      );
    }
    report.status = status;
    report.resolvedAt = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),

  // Learning

  // Like the API: new to the athlete first (random), then answered ones at random, weighted by
  // days since answered + 1; the skipped ones left out; with concepts, only questions accepted
  // for one of them. 204 if none. Also counts the never-answered ones in the pick. Open to
  // visitors, for whom everything is new. From the pool to verify: the unverified ones the
  // athlete may verify, picked the same way, counting every one left.
  http.get(url("/learning/questions/next"), ({ request }) => {
    const query = new URL(request.url).searchParams;
    const concepts = query.getAll("concepts");
    const skip = query.getAll("skip").map(Number);
    const pool = query.get("pool") ?? "ALL";
    const tagsOf = (question: Question) => (inPool(question, pool) ? acceptedTags(question) : []);
    const lastAnsweredAt = (questionId: number) =>
      isSignedIn()
        ? answers.find((answer) => answer.questionId === questionId)?.answeredAt // newest first
        : undefined;

    const inPick = questions
      .filter(availableForLearning)
      .filter((question) => tagsOf(question).length > 0)
      .filter((question) =>
        concepts.length === 0
          ? tagsOf(question).some(isFeatured) // all muscles: the gym's pool
          : tagsOf(question).some((tag) => concepts.includes(tag)),
      );
    const candidates = inPick.filter((question) => !skip.includes(question.id));
    const unanswered = candidates.filter((question) => !lastAnsweredAt(question.id));
    const weightOf = (question: Question) =>
      (Date.now() - Date.parse(lastAnsweredAt(question.id)!)) / 86_400_000 + 1;
    const picked =
      unanswered.length > 0
        ? unanswered[Math.floor(Math.random() * unanswered.length)]
        : weightedPick(candidates, weightOf);
    if (!picked) return new HttpResponse(null, { status: 204 });

    const next: LearningQuestion = {
      id: picked.id,
      title: picked.title,
      requirement: picked.requirement,
      difficultyScore: picked.difficultyScore,
      source: picked.source,
      conceptTags: tagsOf(picked),
      verified: picked.verified,
      canVerify: canVerify(picked),
      // Like the API: never answered by this athlete, skipped or not; to verify, every one left.
      unansweredCount:
        pool === "TO_VERIFY"
          ? inPick.length
          : inPick.filter((question) => !lastAnsweredAt(question.id)).length,
      upVotes: withMyVote(picked).upVotes,
      downVotes: withMyVote(picked).downVotes,
      myVote: isSignedIn() ? (myVotes.get(picked.id) ?? null) : null,
    };
    return HttpResponse.json(next);
  }),

  // As the API: one chosen exercise (a retry), if it can be trained; the count of new ones is for
  // the given muscles, or else its own. After /next, which it would otherwise match.
  http.get(url("/learning/questions/:id"), ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question || !availableForLearning(question)) {
      return HttpResponse.json(
        { message: `Question ${params.id} is not available for learning` },
        { status: 404 },
      );
    }
    const requested = new URL(request.url).searchParams.getAll("concepts");
    const concepts = requested.length > 0 ? requested : acceptedTags(question);
    const pool = new URL(request.url).searchParams.get("pool") ?? "ALL";
    const tagsOf = (candidate: Question) =>
      inPool(candidate, pool) ? acceptedTags(candidate) : [];
    const answered = (id: number) => answers.some((answer) => answer.questionId === id);
    const chosen: LearningQuestion = {
      id: question.id,
      title: question.title,
      requirement: question.requirement,
      difficultyScore: question.difficultyScore,
      source: question.source,
      conceptTags: acceptedTags(question),
      verified: question.verified,
      canVerify: canVerify(question),
      unansweredCount: questions
        .filter(availableForLearning)
        .filter((candidate) => tagsOf(candidate).some((tag) => concepts.includes(tag)))
        .filter((candidate) => pool === "TO_VERIFY" || !answered(candidate.id)).length,
      upVotes: withMyVote(question).upVotes,
      downVotes: withMyVote(question).downVotes,
      myVote: isSignedIn() ? (myVotes.get(question.id) ?? null) : null,
    };
    return HttpResponse.json(chosen);
  }),

  http.post(url("/learning/answers"), async ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    const input = (await request.json()) as { questionId?: number; answer?: string };
    if (!input.answer?.trim()) {
      return HttpResponse.json({ message: "answer is required" }, { status: 400 });
    }
    const question = questions.find((candidate) => candidate.id === input.questionId);
    if (!question || !availableForLearning(question)) {
      return HttpResponse.json(
        { message: `Question ${input.questionId} is not available for learning` },
        { status: 404 },
      );
    }
    const created: Answer = {
      id: Math.max(0, ...answers.map((answer) => answer.id)) + 1,
      questionId: question.id,
      answer: input.answer,
      question: { ...question, conceptTags: acceptedTags(question) },
      selfGrade: null,
      perceivedDifficulty: null,
      answeredAt: now(),
    };
    answers.unshift(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(url("/learning/answers/:id/assessment"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const answer = answers.find((candidate) => candidate.id === Number(params.id));
    if (!answer) {
      return HttpResponse.json(
        { message: `Answer with id '${params.id}' not found` },
        { status: 404 },
      );
    }
    const assessment = (await request.json()) as Assessment;
    answer.selfGrade = assessment.selfGrade ?? null;
    answer.perceivedDifficulty = assessment.perceivedDifficulty ?? null;
    return HttpResponse.json(answer);
  }),

  http.post(url("/learning/questions/:id/reports"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const question = questions.find((candidate) => candidate.id === Number(params.id));
    if (!question || !availableForLearning(question)) {
      return HttpResponse.json(
        { message: `Question ${params.id} is not available for learning` },
        { status: 404 },
      );
    }
    const input = (await request.json()) as { reason?: ReportReason; note?: string };
    if (!input.reason) {
      return HttpResponse.json({ message: "reason is required" }, { status: 400 });
    }
    if (myOpenReport(question.id)) {
      return HttpResponse.json(
        { message: `You already reported question ${question.id}` },
        { status: 409 },
      );
    }
    const id = Math.max(0, ...reports.map((report) => report.id)) + 1;
    reportedByMe.set(question.id, id);
    reports.push({
      id,
      question,
      reason: input.reason,
      note: input.note ?? null,
      resolvedAt: null,
      status: "OPEN",
      reportedAt: now(),
    });
    return new HttpResponse(null, { status: 201 });
  }),

  http.get(url("/learning/questions/:id/reports/mine"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    const mine = myOpenReport(Number(params.id));
    return mine ? HttpResponse.json(asMyFeedback(mine)) : new HttpResponse(null, { status: 204 });
  }),

  http.put(url("/learning/questions/:id/reports/mine"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const mine = myOpenReport(Number(params.id));
    if (!mine) return noOpenFeedback(params.id);
    const input = (await request.json()) as { reason?: ReportReason; note?: string };
    if (!input.reason) {
      return HttpResponse.json({ message: "reason is required" }, { status: 400 });
    }
    mine.reason = input.reason;
    mine.note = input.note ?? null;
    return HttpResponse.json(asMyFeedback(mine));
  }),

  http.delete(url("/learning/questions/:id/reports/mine"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    const mine = myOpenReport(Number(params.id));
    if (!mine) return noOpenFeedback(params.id);
    reports.splice(reports.indexOf(mine), 1);
    reportedByMe.delete(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.put(url("/learning/questions/:id/vote"), async ({ params, request }) => {
    if (!isSignedIn()) return signInRequired();
    const { vote } = (await request.json()) as { vote?: Vote };
    if (!vote) return HttpResponse.json({ message: "vote is required" }, { status: 400 });
    myVotes.set(Number(params.id), vote);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(url("/learning/questions/:id/vote"), ({ params }) => {
    if (!isSignedIn()) return signInRequired();
    myVotes.delete(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url("/learning/answers"), ({ request }) => {
    if (!isSignedIn()) return signInRequired();
    const questionId = new URL(request.url).searchParams.get("questionId");
    return HttpResponse.json(
      questionId === null
        ? answers
        : answers.filter((answer) => answer.questionId === Number(questionId)),
    );
  }),
];

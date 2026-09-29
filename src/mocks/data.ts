import type {
  Answer,
  Concept,
  ConceptStatus,
  ContributionPolicy,
  Question,
  QuestionStatus,
  Report,
  User,
} from "@/api/types";

/**
 * Sample content for mock mode (`npm run dev:mock`). Typed with the API's own types, so a
 * change in the API shows up here as a type error instead of a silently outdated mock.
 * Muscle names and descriptions come from the original concept seed (a scrapped earlier design).
 */

const created = "2026-09-01T09:00:00Z";

export const mockUser: User = {
  id: 1,
  displayName: "mock_coach",
  avatarUrl: null,
  role: "ADMIN",
  status: "ACTIVE",
  createdAt: "2026-08-15T10:00:00Z",
  lastLoginAt: created,
};

/** Another member, whose exercises wait on mock_coach's muscles in the spot check. */
const guestLifterId = 2;

/**
 * Everyone else at the gym, for the front desk: a member, gym staff, a blocked member, and enough
 * athletes for a second page.
 */
export const mockMembers: User[] = [
  {
    id: guestLifterId,
    displayName: "guest_lifter",
    avatarUrl: null,
    role: "MEMBER",
    status: "ACTIVE",
    createdAt: "2026-08-20T10:00:00Z",
    lastLoginAt: created,
  },
  {
    id: 3,
    displayName: "spotter_sam",
    avatarUrl: null,
    role: "STAFF",
    status: "ACTIVE",
    createdAt: "2026-08-22T10:00:00Z",
    lastLoginAt: created,
  },
  {
    id: 4,
    displayName: "rep_skipper",
    avatarUrl: null,
    role: "MEMBER",
    status: "BLOCKED",
    createdAt: "2026-08-25T10:00:00Z",
    lastLoginAt: null,
  },
  ...Array.from({ length: 20 }, (_, index): User => ({
    id: 5 + index,
    displayName: `lifter_${String(index + 1).padStart(2, "0")}`,
    avatarUrl: null,
    role: "MEMBER",
    status: "ACTIVE",
    createdAt: "2026-09-05T10:00:00Z",
    lastLoginAt: "2026-10-10T10:00:00Z",
  })),
];

function concept(
  tag: string,
  name: string,
  description: string,
  status: ConceptStatus = "ACTIVE",
  contributionPolicy: ContributionPolicy = "AUTO_ACCEPT",
): Concept {
  return {
    tag,
    name,
    description,
    externalReferences: [],
    status,
    contributionPolicy,
    createdBy: mockUser.id,
    updatedBy: mockUser.id,
    createdAt: created,
    updatedAt: created,
  };
}

export const mockConcepts: Concept[] = [
  concept(
    "autoboxing-and-unboxing",
    "Autoboxing & Unboxing",
    "Automatic conversion between primitives and wrapper types, and its performance/identity pitfalls.",
  ),
  concept(
    "class-loading",
    "Class Loading",
    "Bootstrap/platform/application class loaders, the delegation model, and custom class loaders.",
  ),
  concept(
    "collectors-and-grouping",
    "Collectors & Grouping",
    "Collectors.toMap/groupingBy/partitioningBy and building custom collectors.",
  ),
  concept(
    "equals-hashcode-contract",
    "equals()/hashCode() Contract",
    "The contract between equals() and hashCode(), and the consequences of breaking it.",
  ),
  concept(
    "happens-before-relationship",
    "Happens-Before Relationship",
    "The formal ordering guarantee that underlies visibility and ordering in the JMM.",
  ),
  concept(
    "hashmap-internals",
    "HashMap Internals",
    "Bucket structure, hashing/collision resolution, load factor, and resize behavior.",
  ),
  concept(
    "immutable-objects",
    "Immutable Objects",
    "Designing immutable classes, defensive copying, and the thread-safety benefits.",
  ),
  concept(
    "iterators-and-fail-fast",
    "Iterators & Fail-Fast Behavior",
    "Iterator/ListIterator, fail-fast vs. fail-safe iteration, and ConcurrentModificationException.",
  ),
  concept(
    "jit-compilation",
    "JIT Compilation",
    "Interpreted execution vs. JIT-compiled tiers, and hot-spot optimization.",
  ),
  concept(
    "race-conditions",
    "Race Conditions",
    "Identifying race conditions and understanding why unsynchronized shared mutable state is unsafe.",
  ),
  concept(
    "raw-types",
    "Raw Types",
    "Legacy raw type usage, unchecked warnings, and interop with pre-generics code.",
    "RETIRED",
  ),
  concept(
    "records-and-sealed-classes",
    "Records & Sealed Classes",
    "Record classes for data carriers, and sealed classes/interfaces for restricted hierarchies.",
  ),
  concept(
    "stream-short-circuiting",
    "Stream Short-Circuiting",
    "Short-circuiting operations like findFirst, anyMatch, and limit.",
  ),
  concept(
    "string-pool-and-interning",
    "String Pool & Interning",
    "The string constant pool, literal interning, and how new String(...) bypasses it.",
    "ACTIVE",
    "OWNER_APPROVAL",
  ),
  concept(
    "switch-expressions-and-pattern-matching",
    "Switch Expressions & Pattern Matching",
    "Modern switch expressions, pattern matching for instanceof/switch, and record patterns.",
  ),
  concept(
    "try-with-resources",
    "Try-With-Resources",
    "Automatic resource management, AutoCloseable, and suppressed exceptions.",
    "ACTIVE",
    "OWNER_APPROVAL",
  ),
  concept(
    "type-erasure",
    "Type Erasure",
    "How generics are implemented via erasure and its runtime consequences.",
  ),
  concept(
    "virtual-threads",
    "Virtual Threads",
    "Lightweight JVM-managed threads (Java 21+), and how they change thread-per-task cost trade-offs.",
  ),
  concept(
    "volatile-keyword",
    "The volatile Keyword",
    "Visibility guarantees provided by volatile, and why it doesn't guarantee atomicity.",
  ),
  concept(
    "wildcards-and-pecs",
    "Wildcards & PECS",
    "Wildcard types (? extends, ? super) and the Producer-Extends-Consumer-Super principle.",
  ),
  // A member's new muscle, waiting for staff to publish it (only staff publish at launch).
  {
    ...concept(
      "kotlin-coroutines",
      "Kotlin Coroutines",
      "Suspending functions, scopes and structured concurrency.",
      "DRAFT",
    ),
    createdBy: guestLifterId,
    updatedBy: guestLifterId,
  },
];

let nextQuestionId = 1;

function question(
  fields: {
    title: string;
    requirement: string;
    sampleSolution: string;
    difficultyScore: number;
    conceptTags: string[];
    source?: string;
  },
  author: number = mockUser.id,
  status: QuestionStatus = "SUBMITTED",
): Question {
  return {
    id: nextQuestionId++,
    source: null,
    ...fields,
    status,
    createdBy: author,
    updatedBy: author,
    createdAt: created,
    updatedAt: created,
    // Other athletes' votes; mock_coach's own come on top, in the handlers.
    upVotes: 0,
    downVotes: 0,
  };
}

export const mockQuestions: Question[] = [
  question({
    difficultyScore: 3,
    title: "Boxed integers and ==",
    conceptTags: ["autoboxing-and-unboxing"],
    requirement: [
      "What does this print?",
      "",
      "```java",
      "Integer a = 127, b = 127;",
      "Integer c = 128, d = 128;",
      "System.out.println(a == b);",
      "System.out.println(c == d);",
      "```",
    ].join("\n"),
    sampleSolution: [
      "true, then false.",
      "",
      "Autoboxing uses `Integer.valueOf`, which caches instances from -128 to 127. a and b are the same cached object; c and d are two different objects, and == compares references. Use equals() for wrapper values.",
    ].join("\n"),
    source: "Java Puzzlers",
  }),
  question({
    difficultyScore: 2,
    title: "The equals and hashCode contract",
    conceptTags: ["equals-hashcode-contract"],
    requirement:
      "State the contract between equals() and hashCode(). What breaks if a class overrides equals() but not hashCode()?",
    sampleSolution:
      "Equal objects must have equal hash codes (the reverse isn't required). If only equals() is overridden, two equal objects usually land in different HashMap/HashSet buckets, so lookups fail and sets can hold 'duplicates'.",
  }),
  question({
    difficultyScore: 8,
    title: "Lazy streams after sorted()",
    conceptTags: ["stream-short-circuiting"],
    requirement: [
      "What does this print, and why?",
      "",
      "```java",
      "List<Integer> numbers = List.of(3, 1, 2);",
      "numbers.stream()",
      "    .sorted()",
      "    .peek(System.out::print)",
      "    .map(n -> n * 2)",
      "    .findFirst();",
      "```",
      "",
      "Explain which elements the stream actually processes, and what changes if you remove sorted().",
    ].join("\n"),
    sampleSolution: [
      "It prints 1.",
      "",
      "sorted() is stateful: it consumes the whole source before emitting anything. After that the pipeline is lazy again, so findFirst() short-circuits after the first element.",
      "",
      "Without sorted(), it prints 3.",
    ].join("\n"),
    source: "Modern Java in Action, ch. 5",
  }),
  question({
    difficultyScore: 6,
    title: "Removing expired sessions",
    conceptTags: ["iterators-and-fail-fast", "hashmap-internals"],
    requirement: [
      "This method should drop all expired sessions. Sometimes it throws. Find the bug and fix it.",
      "",
      "```java",
      "void dropExpired(Map<String, Session> sessions) {",
      "    for (String id : sessions.keySet()) {",
      "        if (sessions.get(id).isExpired()) {",
      "            sessions.remove(id);",
      "        }",
      "    }",
      "}",
      "```",
    ].join("\n"),
    sampleSolution: [
      "Removing from the map while iterating over its keySet() makes the fail-fast iterator throw ConcurrentModificationException on the next step.",
      "",
      "Fix:",
      "```java",
      "sessions.values().removeIf(Session::isExpired);",
      "```",
      "or iterate with an explicit Iterator and call iterator.remove().",
    ].join("\n"),
  }),
  question({
    difficultyScore: 5,
    title: "An immutable Money type",
    conceptTags: ["immutable-objects", "records-and-sealed-classes"],
    requirement:
      "Write an immutable Money value type with an amount (BigDecimal) and a currency (String). Two Money values with the same amount and currency must be equal, and adding Money of different currencies must fail. Show one version as a class and one as a record.",
    sampleSolution: [
      "record Money(BigDecimal amount, String currency) {",
      "    Money {",
      "        Objects.requireNonNull(amount);",
      "        Objects.requireNonNull(currency);",
      "    }",
      "    Money plus(Money other) {",
      '        if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");',
      "        return new Money(amount.add(other.amount), currency);",
      "    }",
      "}",
      "",
      "The class version needs final fields, no setters, and hand-written equals/hashCode. Careful: BigDecimal.equals treats 1.0 and 1.00 as different; normalise with stripTrailingZeros() if that matters.",
    ].join("\n"),
  }),
  question({
    difficultyScore: 7,
    title: "Generic arrays",
    conceptTags: ["type-erasure", "wildcards-and-pecs"],
    requirement:
      "Why can't you create a generic array like new T[10] in Java, while new ArrayList<T>() is fine?",
    sampleSolution:
      "Arrays are reified: they know their component type at runtime and check stores against it. Generics are erased, so T is unknown at runtime and the JVM couldn't enforce the array's type. A List<T> is just a List at runtime, so there's nothing to enforce.",
  }),
  question({
    difficultyScore: 9,
    title: "Virtual threads for slow calls",
    conceptTags: ["virtual-threads", "race-conditions"],
    requirement: [
      "A service calls three slow downstream APIs per request and currently uses a fixed pool of 200 platform threads. Under load, requests queue up while CPU usage stays low.",
      "",
      "1. Explain why, and how virtual threads change the picture.",
      "2. What would you watch out for when switching (think: synchronized blocks, ThreadLocals, connection pools)?",
      "3. Where would a race condition most likely hide in this service after the switch?",
    ].join("\n"),
    sampleSolution: [
      "1. The threads are blocked on I/O, not busy: the pool size caps concurrency. Virtual threads are cheap to create and park while waiting, so one per request (or per call) removes the cap.",
      "",
      "2. Pinning: blocking inside synchronized pins the carrier thread (improved in newer JDKs, prefer ReentrantLock). Large ThreadLocals multiply with millions of threads. Downstream limits don't disappear: the connection pool or a semaphore must still bound concurrency.",
      "",
      "3. In shared mutable state that used to be protected by accident of low concurrency: caches, counters, lazily initialised singletons.",
    ].join("\n"),
    source: "JEP 444",
  }),
  question({
    difficultyScore: 8,
    title: "A loop that never stops",
    conceptTags: ["volatile-keyword", "happens-before-relationship"],
    requirement: [
      "Can this loop run forever? Explain in terms of the Java Memory Model, and give two ways to fix it.",
      "",
      "class Worker {",
      "    private boolean running = true;",
      "    void stop() { running = false; }",
      "    void run() { while (running) { doWork(); } }",
      "}",
    ].join("\n"),
    sampleSolution:
      "Yes. Without a happens-before edge between stop() and the loop's read, the JIT may hoist the read out of the loop and never see the write. Fix with a volatile field, an AtomicBoolean, or by guarding both accesses with the same lock.",
  }),
  question(
    {
      difficultyScore: 4,
      title: "Suppressed exceptions",
      conceptTags: ["try-with-resources"],
      requirement: "What is a suppressed exception, and when does try-with-resources create one?",
      sampleSolution:
        "When the try block throws and closing the resource throws too, the close() exception is attached to the primary one via addSuppressed() instead of replacing it. Read them with getSuppressed().",
    },
    guestLifterId,
  ),
  question(
    {
      difficultyScore: 5,
      title: "String literals and intern()",
      conceptTags: ["string-pool-and-interning"],
      requirement:
        'Is "java" == new String("java") true or false? What about "java" == new String("java").intern()?',
      sampleSolution:
        "false, then true. new String always creates a new object on the heap; intern() returns the pooled instance, which is the same object as the literal.",
    },
    guestLifterId,
  ),
];

/**
 * mock_coach's past sets, spread over the last six weeks so Past Workouts has a history of more
 * than a page.
 * Each keeps a copy of its question, as the API does.
 */
const daysAgo = [
  0, 1, 1, 3, 4, 6, 8, 9, 12, 13, 15, 16, 18, 20, 22, 23, 25, 27, 29, 31, 34, 36, 39, 42,
];
const grades: [number | null, number | null][] = [
  [9, 4],
  [6, 7],
  [null, null],
  [3, 9],
  [8, 5],
  [null, 6],
  [10, 3],
  [5, null],
  [7, 7],
  [4, 8],
];
const ownQuestions = mockQuestions.filter((question) => question.createdBy === mockUser.id);

// Other athletes liked the first of mock_coach's exercises, and found fault with the second.
Object.assign(ownQuestions[0]!, { upVotes: 4, downVotes: 1 });

/**
 * Feedback from other athletes on mock_coach's exercises, for the FEEDBACK tab: open (a problem
 * and praise), and decided (one fixed, one dismissed) for its history.
 */
export const mockReports: Report[] = [
  {
    id: 1,
    question: ownQuestions[1]!,
    reason: "UNCLEAR",
    note: "Took me two reads to see what it's asking. Maybe split it into two questions?",
    status: "OPEN",
    reportedAt: created,
    resolvedAt: null,
  },
  {
    id: 2,
    question: ownQuestions[0]!,
    reason: "PRAISE",
    note: "Short, precise, and the code makes the point. More like this one, please.",
    status: "OPEN",
    reportedAt: created,
    resolvedAt: null,
  },
  {
    id: 3,
    question: ownQuestions[2]!,
    reason: "WRONG",
    note: "The model answer says peek() runs for every element, but findFirst stops it early.",
    status: "RESOLVED",
    reportedAt: "2026-09-20T10:00:00Z",
    resolvedAt: "2026-09-21T08:30:00Z",
  },
  {
    id: 4,
    question: ownQuestions[1]!,
    reason: "OTHER",
    note: "Could it be in Kotlin too?",
    status: "DISMISSED",
    reportedAt: "2026-09-18T10:00:00Z",
    resolvedAt: "2026-09-19T17:00:00Z",
  },
];

export const mockAnswers: Answer[] = daysAgo.map((days, index) => {
  const question = ownQuestions[index % ownQuestions.length]!;
  const answeredAt = new Date();
  answeredAt.setDate(answeredAt.getDate() - days);
  answeredAt.setHours(18, index, 0, 0);
  const [selfGrade, perceivedDifficulty] = grades[index % grades.length]!;
  return {
    id: 100 + index,
    questionId: question.id,
    answer: "My answer from that session.",
    question,
    selfGrade,
    perceivedDifficulty,
    answeredAt: answeredAt.toISOString(),
  };
});

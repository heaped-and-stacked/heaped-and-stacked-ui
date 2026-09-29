import {
  useConcepts,
  useCurrentUser,
  useReviewQuestion,
  useReviews,
  useVerifyExercise,
} from "@/api/queries";
import { useEffect, useState } from "react";
import { mayVerify, type Review, type ReviewDecision } from "@/api/types";
import { Button, ErrorMessage, PAGE_SIZE, Pager, RichText, withLinks } from "@/components/ui";

/**
 * INBOX's first part: exercises others added to the user's muscles (the gym's pool too, for staff),
 * waiting for a yes or no, one per muscle they're waiting on, a page at a time.
 */
export function ToApprove() {
  const [page, setPage] = useState(0);
  const { data: result, isPlaceholderData } = useReviews({ page, size: PAGE_SIZE });
  const reviews = result?.items;
  const reviewQuestion = useReviewQuestion();
  const verifyExercise = useVerifyExercise();
  const { data: concepts = [] } = useConcepts();
  const { data: user } = useCurrentUser();
  // APPROVE: it fits, and it's checked: accepted and verified at once.
  const approve = (review: Review) =>
    reviewQuestion.mutate(
      { questionId: review.question.id, conceptTag: review.conceptTag, decision: "ACCEPTED" },
      {
        onSuccess: () => verifyExercise.mutate({ questionId: review.question.id, verified: true }),
      },
    );

  // A decided exercise leaves the list: when the last page empties, step back.
  useEffect(() => {
    if (result && result.totalPages > 0 && page >= result.totalPages) {
      setPage(result.totalPages - 1);
    }
  }, [result, page]);

  if (!result || !reviews) return null;
  if (reviews.length === 0) {
    return (
      <section>
        <p className="font-display text-[9px] text-ink/70">TO APPROVE</p>
        <p className="mt-3 border-2 border-dashed border-ink/30 p-6 text-xs font-medium text-faded">
          // nothing to approve: no exercises are waiting for your yes or no
        </p>
      </section>
    );
  }

  const decide = (review: Review, decision: ReviewDecision) =>
    reviewQuestion.mutate({
      questionId: review.question.id,
      conceptTag: review.conceptTag,
      decision,
    });

  return (
    <section>
      <p className="font-display text-[9px] text-ink/70">TO APPROVE</p>
      <p className="mt-2 text-xs font-semibold text-faded">
        <span className="text-amber-ink">{result.totalItems}</span> waiting for your review ·
        decline duplicates and misfits
      </p>

      <div
        className={`pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-amber bg-card transition-opacity ${
          isPlaceholderData ? "opacity-60" : ""
        }`}
      >
        {reviews.map((review) => (
          <article key={`${review.question.id}-${review.conceptTag}`} className="p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-faded">
              <span className="border-2 border-line bg-amber px-2 py-0.5 text-on-amber">
                #{review.conceptTag}
              </span>
              <span>load {review.question.difficultyScore}/10</span>
            </div>

            <p className="mt-3 text-sm font-bold">{review.question.title}</p>
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-ink/70">
              {review.question.requirement}
            </p>

            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-semibold text-faded hover:text-ink">
                read the full exercise and sample set
              </summary>
              <div className="mt-3 grid gap-6 lg:grid-cols-2">
                <div className="min-w-0">
                  <p className="font-display text-[9px] text-ink/70">THE EXERCISE</p>
                  <RichText text={review.question.requirement} className="mt-2" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[9px] text-ink/70">SAMPLE SET</p>
                  <RichText text={review.question.sampleSolution} className="mt-2 text-ink/80" />
                </div>
              </div>
              {review.question.source && (
                <p className="mt-2 text-[11px] text-faded">
                  source: {withLinks(review.question.source)}
                </p>
              )}
            </details>

            <div className="mt-4 flex flex-wrap gap-3">
              {user && mayVerify(review.question.conceptTags, concepts, user) && (
                <Button
                  variant="pixel"
                  disabled={reviewQuestion.isPending || verifyExercise.isPending}
                  onClick={() => approve(review)}
                  title="It fits, and it's checked: accepted and verified"
                >
                  APPROVE
                </Button>
              )}
              <Button
                variant="paper"
                disabled={reviewQuestion.isPending}
                onClick={() => decide(review, "ACCEPTED")}
                title="It fits; check it later"
              >
                ACCEPT
              </Button>
              <Button
                variant="paper"
                disabled={reviewQuestion.isPending}
                onClick={() => decide(review, "DECLINED")}
              >
                DECLINE
              </Button>
            </div>
          </article>
        ))}
      </div>
      <Pager
        label="Pages of exercises to approve"
        page={page}
        totalPages={result.totalPages}
        onPage={setPage}
      />
      <ErrorMessage error={reviewQuestion.error ?? verifyExercise.error} />
    </section>
  );
}

import { useReviewQuestion, useReviews } from "@/api/queries";
import type { Review, ReviewDecision } from "@/api/types";
import { Button, ErrorMessage, RichText } from "@/components/ui";

/**
 * Exercises waiting for the signed-in user's approval, one per muscle they're waiting on.
 * The SPOT CHECK tab of Coach's Corner.
 */
export function SpotCheck() {
  const { data: reviews } = useReviews();
  const reviewQuestion = useReviewQuestion();

  if (!reviews) return null;
  if (reviews.length === 0) {
    return (
      <p className="border-2 border-dashed border-ink/30 p-6 text-xs font-medium text-faded">
        // nothing to spot: no exercises are waiting for your approval
      </p>
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
      <p className="text-xs font-semibold text-faded">
        <span className="text-amber-ink">{reviews.length}</span> waiting for your spot · decline
        duplicates and misfits
      </p>

      <div className="pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-amber bg-card">
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
                read the full exercise and model answer
              </summary>
              <div className="mt-3 grid gap-6 lg:grid-cols-2">
                <div className="min-w-0">
                  <p className="font-display text-[9px] text-ink/70">THE EXERCISE</p>
                  <RichText text={review.question.requirement} className="mt-2" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[9px] text-ink/70">MODEL ANSWER</p>
                  <RichText text={review.question.sampleSolution} className="mt-2 text-ink/80" />
                </div>
              </div>
              {review.question.source && (
                <p className="mt-2 text-[11px] text-faded">source: {review.question.source}</p>
              )}
            </details>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="pixel"
                disabled={reviewQuestion.isPending}
                onClick={() => decide(review, "ACCEPTED")}
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
      <ErrorMessage error={reviewQuestion.error} />
    </section>
  );
}

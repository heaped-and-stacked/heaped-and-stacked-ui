import { useSyncExternalStore } from "react";
import { useConcepts, useCurrentUser } from "@/api/queries";
import { curatesAllContent } from "@/api/types";
import { Button, Card } from "./ui";

/**
 * Reviewer mode: whoever curates (staff and admins; later, members who own a muscle) switches
 * between two ways of using the app. Off, the default: the app as every member sees it (their own
 * exercises and feedback, every exercise to train on). On: the curating comes in, and only
 * then: TO VERIFY with REVIEW, ✓ VERIFY and ✎ FIX on the rack, the MUSCLES tab and muscle pages,
 * the gym's exercises and feedback, approvals in the INBOX, BENCH and DELETE.
 *
 * It only changes what the screens show: the API's rules stay the same either way. The choice is
 * a convenience in localStorage (off again after a reload without storage).
 */
const REVIEWER_KEY = "hs.reviewer";
const listeners = new Set<() => void>();
let chosen: boolean = readReviewer();

function readReviewer(): boolean {
  try {
    return localStorage.getItem(REVIEWER_KEY) === "on";
  } catch {
    return false;
  }
}

function setReviewing(on: boolean) {
  chosen = on;
  try {
    localStorage.setItem(REVIEWER_KEY, on ? "on" : "off");
  } catch {
    // Not stored: the choice lasts until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * `canReview`: the user curates something (staff, or the owner of a muscle). `reviewing`: they
 * do, and reviewer mode is on. Visitors and members without a muscle never review.
 */
export function useReviewer() {
  const { data: user } = useCurrentUser();
  const { data: concepts } = useConcepts();
  const on = useSyncExternalStore(subscribe, () => chosen);
  const canReview =
    user != null &&
    (curatesAllContent(user.role) || (concepts ?? []).some((c) => c.createdBy === user.id));
  return { canReview, reviewing: canReview && on, setReviewing };
}

/**
 * In place of a curator's screen (a muscle's page, someone else's exercise) reached outside
 * reviewer mode, e.g. from an old link: what it is, and the way in or back.
 */
export function ReviewerModeNeeded({ text, onBack }: { text: string; onBack: () => void }) {
  const { setReviewing } = useReviewer();
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <p className="text-sm font-medium text-ink/70">{text}</p>
      <p className="mt-2 text-[11px] text-faded">// curating happens in reviewer mode</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => setReviewing(true)}>TURN ON REVIEWER MODE</Button>
        <Button variant="paper" onClick={onBack}>
          BACK
        </Button>
      </div>
    </Card>
  );
}

import type { ContributionPolicy, ReportReason, UserRole } from "@/api/types";

/** How API enum values and scales are shown in the UI. */

/** What a role is called in the gym (Locker Room badge). */
export const roleLabels: Record<UserRole, string> = {
  MEMBER: "ATHLETE",
  STAFF: "GYM STAFF",
  ADMIN: "HEAD COACH",
};

/** Whether other coaches' exercises go live on a muscle straight away, as shown in muscle lists. */
export const contributionPolicyLabels: Record<ContributionPolicy, string> = {
  AUTO_ACCEPT: "open to all coaches",
  OWNER_APPROVAL: "you approve other coaches' exercises",
};

/**
 * What an athlete's feedback on an exercise says. ▲ good one sends praise; ▼ not great offers
 * only `problemReasons`. The API also knows DUPLICATE and INAPPROPRIATE (the form folds them
 * into "something else"); their labels stay for feedback sent with them.
 */
export const reportReasonLabels: Record<ReportReason, string> = {
  PRAISE: "keep it, more like this",
  WRONG: "the model answer is wrong",
  UNCLEAR: "the exercise is wrong or unclear",
  DUPLICATE: "duplicate of another",
  INAPPROPRIATE: "inappropriate",
  OTHER: "not great",
};

/** What ▼ not great offers, by what is at fault: the exercise, its model answer, or something else. */
export const problemReasons: ReportReason[] = ["UNCLEAR", "WRONG", "OTHER"];

/** The athlete's own grade of an answer, from "poor form" (1) to "nailed it" (10). */
export function selfGradeLabel(grade: number): string {
  if (grade <= 2) return "poor form";
  if (grade <= 4) return "wobbly";
  if (grade <= 6) return "solid rep";
  if (grade <= 8) return "strong";
  return "nailed it";
}

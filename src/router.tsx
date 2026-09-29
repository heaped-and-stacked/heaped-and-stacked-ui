import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppError, Layout, NotFound } from "./components/Layout";
import { CoachsCornerPage, isCoachTab, type CoachTab } from "./pages/coach/CoachsCornerPage";
import { ExercisePage } from "./pages/coach/ExercisePage";
import { FrontDeskPage } from "./pages/FrontDeskPage";
import {
  AboutPage,
  CodeOfConductPage,
  ContactPage,
  PrivacyPage,
  TermsPage,
} from "./pages/SitePages";
import { PastWorkoutsPage } from "./pages/PastWorkoutsPage";
import { SetReviewPage } from "./pages/SetReviewPage";
import { LandingPage } from "./pages/LandingPage";
import { LockerRoomPage } from "./pages/LockerRoomPage";
import { RackPage } from "./pages/rack/RackPage";
import { TrainPage } from "./pages/rack/TrainPage";

/** Every page of the app. To add one: create it in pages/, add a route here, add it to routeTree. */

/** The browser tab's title: the page first, so tabs stay tellable apart. */
const title = (page: string) => ({ meta: [{ title: `${page} · Heaped & Stacked` }] });

const rootRoute = createRootRoute({
  component: Layout,
  head: () => ({ meta: [{ title: "Heaped & Stacked: a gym for your brain" }] }),
  notFoundComponent: NotFound,
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
  // The API sends the browser back to "/?signInError" when GitHub sign-in fails.
  validateSearch: (search: Record<string, unknown>): { signInError?: true } =>
    "signInError" in search ? { signInError: true } : {},
});

const coachsCornerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/coach",
  component: CoachsCornerPage,
  head: () => title("Coach's Corner"),
  // The open tab: /coach?tab=muscle. No tab (or an unknown one) = the first one, ADD EXERCISE.
  // edit: what the tab's form edits instead of adding: an exercise id or a muscle tag.
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: CoachTab; edit?: number | string } => ({
    tab: isCoachTab(search.tab) ? search.tab : "exercise",
    ...((typeof search.edit === "number" || typeof search.edit === "string") && {
      edit: search.edit,
    }),
  }),
});

// One exercise to manage, for its author and staff: its text, votes, all its feedback, and actions.
const exerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/coach/exercises/$questionId",
  component: ExercisePage,
  head: () => title("Exercise"),
});

const lockerRoomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/locker-room",
  component: LockerRoomPage,
  head: () => title("Locker Room"),
});

// Admins only: roles and blocking (the API refuses everyone else too).
const frontDeskRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/front-desk",
  component: FrontDeskPage,
  // No title of its own: to anyone but an admin, this page doesn't exist.
});

const pastWorkoutsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workouts",
  component: PastWorkoutsPage,
  head: () => title("Past Workouts"),
});

// The athlete's sets of one exercise, one at a time: /workouts/12?set=345 (no set: the latest).
const setReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workouts/$questionId",
  component: SetReviewPage,
  head: () => title("Set Review"),
  validateSearch: (search: Record<string, unknown>): { set?: number } =>
    typeof search.set === "number" ? { set: search.set } : {},
});

const trainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/train",
  // The muscles to train come from the workout bar (components/WorkoutBar.tsx).
  component: TrainPage,
  head: () => title("Training Rack"),
});

const rackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rack/$questionId",
  component: RackPage,
  head: () => title("Exercise Preview"),
});

// The footer pages (pages/SitePages.tsx): plain text, open to everyone.
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: AboutPage,
  head: () => title("About"),
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
  head: () => title("Privacy"),
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
  head: () => title("Terms"),
});

const codeOfConductRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/code-of-conduct",
  component: CodeOfConductPage,
  head: () => title("Code of Conduct"),
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: ContactPage,
  head: () => title("Contact"),
});

const routeTree = rootRoute.addChildren([
  landingRoute,
  coachsCornerRoute,
  exerciseRoute,
  pastWorkoutsRoute,
  setReviewRoute,
  trainRoute,
  rackRoute,
  lockerRoomRoute,
  frontDeskRoute,
  aboutRoute,
  privacyRoute,
  termsRoute,
  codeOfConductRoute,
  contactRoute,
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  // A page that crashes shows a friendly "something broke" with a reload, not a stack trace.
  defaultErrorComponent: AppError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

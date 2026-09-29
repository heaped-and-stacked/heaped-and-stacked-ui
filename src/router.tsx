import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppError, Layout, NotFound } from "./components/Layout";
import { CoachsCornerPage, isCoachTab, type CoachTab } from "./pages/coach/CoachsCornerPage";
import { ExercisePage, type ExerciseFrom } from "./pages/coach/ExercisePage";
import { MusclePage } from "./pages/coach/MusclePage";
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
  // The API sends the browser back to "/?signInError=<why>" when sign-in fails (not_invited,
  // account_not_active, sign_in_failed, ...).
  validateSearch: (search: Record<string, unknown>): { signInError?: string } =>
    "signInError" in search
      ? {
          signInError:
            typeof search.signInError === "string" ? search.signInError : "sign_in_failed",
        }
      : {},
});

const coachsCornerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/coach",
  component: CoachsCornerPage,
  head: () => title("Coach's Corner"),
  // The open tab: /coach?tab=inbox. No tab (or an unknown one) = the first one shown.
  // new: the MUSCLES tab opens with the new-muscle form.
  // muscle: the EXERCISES tab opens filtered on it (SEE ALL EXERCISES on a muscle's page).
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: CoachTab; new?: true; muscle?: string } => ({
    ...(isCoachTab(search.tab) ? { tab: search.tab } : {}),
    ...(search.new === true || search.new === "true" ? { new: true as const } : {}),
    ...(typeof search.muscle === "string" && search.muscle ? { muscle: search.muscle } : {}),
  }),
});

// One muscle the user curates: what it is, how far it's verified, and the way into the work.
const muscleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/coach/muscles/$tag",
  component: MusclePage,
  head: () => title("Muscle"),
});

// Where an exercise screen was opened from, so saving or cancelling goes back there: the
// workout, the inbox, the exercises list, or a muscle's page (muscle=<tag>, which also picks that
// muscle for a new exercise).
const exerciseSearch = (
  search: Record<string, unknown>,
): { from?: ExerciseFrom; muscle?: string } => ({
  ...(search.from === "train" || search.from === "inbox" || search.from === "exercises"
    ? { from: search.from }
    : {}),
  ...(typeof search.muscle === "string" && search.muscle ? { muscle: search.muscle } : {}),
});

// A new exercise: the same screen as editing one.
const newExerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/coach/exercises/new",
  component: ExercisePage,
  head: () => title("New exercise"),
  validateSearch: exerciseSearch,
});

// One exercise, for its author and whoever curates it: the form, and beside it how athletes rate
// it, its feedback, and BENCH and DELETE.
const exerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/coach/exercises/$questionId",
  component: ExercisePage,
  head: () => title("Exercise"),
  validateSearch: exerciseSearch,
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
  muscleRoute,
  newExerciseRoute,
  exerciseRoute,
  pastWorkoutsRoute,
  setReviewRoute,
  trainRoute,
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

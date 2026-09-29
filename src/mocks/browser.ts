import { setupWorker } from "msw/browser";
import { API_URL } from "@/api/client";
import { handlers, setSignedIn } from "./handlers";

/**
 * Starts the pretend API (mock mode only). Must finish before the app renders, so the app's
 * first requests are already answered by the mocks.
 */
export async function startMockApi(): Promise<void> {
  // "Sign in with GitHub" points to /?mockSignIn in mock mode (see SIGN_IN_URL).
  const params = new URLSearchParams(window.location.search);
  if (params.has("mockSignIn")) {
    setSignedIn(true);
    window.history.replaceState(null, "", "/");
  }

  await setupWorker(...handlers).start({
    quiet: true,
    // Warn only about API calls without a mock; let assets and Vite's own requests through.
    onUnhandledRequest: (request, print) => {
      if (request.url.startsWith(API_URL)) print.warning();
    },
  });
}

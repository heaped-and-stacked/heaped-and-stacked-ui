import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

/**
 * The one place that talks HTTP to the Spring Boot API.
 *
 * - The session lives in a cookie set by the API, so every call sends credentials.
 * - Spring Security rejects POST/PUT/DELETE without the session's CSRF token, so the
 *   middleware below adds it to every write.
 * - Errors come back as {"message": "..."}; call() turns them into an ApiError.
 */

export const API_URL: string = import.meta.env.VITE_API_URL;

/** Mock mode (`npm run dev:mock`): src/mocks answers every API call; no backend needed. */
export const MOCK_API = import.meta.env.VITE_MOCK_API === "true";

/**
 * Full-page navigation here starts "Sign in with GitHub"; GitHub then returns to the UI.
 * In mock mode it just returns to the app, which signs the mock user in.
 */
export const SIGN_IN_URL = MOCK_API ? "/?mockSignIn" : `${API_URL}/oauth2/authorization/github`;

const RETURN_TO_KEY = "hs.signIn.returnTo";

/**
 * Signs in, then comes back to `path` instead of the home page (the API always returns to the
 * UI's root; the landing page follows up with takeSignInReturnPath). Only the path is kept, in
 * this tab's session storage: nothing auth-related.
 */
export function signInAndReturnTo(path: string): void {
  try {
    sessionStorage.setItem(RETURN_TO_KEY, path);
  } catch {
    // Not stored: the athlete lands on the home page instead.
  }
  window.location.href = SIGN_IN_URL;
}

/** Signs in and comes back to the page the athlete is on now (for plain "SIGN IN" links). */
export function signInHere(): void {
  signInAndReturnTo(window.location.pathname + window.location.search);
}

/** The page to go back to after signing in, once; null when there's none. */
export function takeSignInReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return path;
  } catch {
    return null;
  }
}

export const api = createClient<paths>({ baseUrl: API_URL, credentials: "include" });

export class ApiError extends Error {
  readonly status: number;
  /**
   * The API's X-Request-Id for the failed call: its log lines carry the same id, so quoting it
   * in a bug report finds them. null when there was no answer at all.
   */
  readonly requestId: string | null;

  constructor(status: number, message: string, requestId: string | null = null) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}

const requestIdOf = (response: Response) => response.headers.get("X-Request-Id");

/**
 * Fetches a fresh CSRF token before every write. One extra request, but the token is
 * never stale: it changes whenever the session does (signing in or out).
 */
const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    if (request.method !== "GET") {
      const { headerName, token } = await fetchCsrfToken();
      request.headers.set(headerName, token);
    }
    return request;
  },
};

api.use(csrfMiddleware);

/** Status used for "no answer at all": the API is down or the network is gone. */
export const UNREACHABLE = 0;

/** Plain fetch against the API, for the few calls outside the OpenAPI spec. */
async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  } catch {
    throw unreachable();
  }
}

function unreachable(): ApiError {
  return new ApiError(UNREACHABLE, "Can't reach the gym right now. Is the API running?");
}

async function fetchCsrfToken(): Promise<{ headerName: string; token: string }> {
  const response = await fetchApi("/csrf");
  if (!response.ok) {
    // Only signed-in sessions get a token: a 401 here means the session ended.
    const message = response.status === 401 ? "Sign in required" : "Could not get a CSRF token";
    throw new ApiError(response.status, message, requestIdOf(response));
  }
  return response.json();
}

/** Awaits an api.GET/POST/... call and returns its data, or throws an ApiError. */
export async function call<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: Awaited<typeof request>;
  try {
    result = await request;
  } catch (error) {
    throw error instanceof ApiError ? error : unreachable();
  }

  const { data, error, response } = result;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageOf(error) ?? `Request failed (${response.status})`,
      requestIdOf(response),
    );
  }
  return data as T;
}

function messageOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "message" in error) {
    return typeof error.message === "string" ? error.message : undefined;
  }
  return undefined;
}

/** POST /logout is served by Spring Security itself, so it isn't in the OpenAPI spec. */
export async function signOut(): Promise<void> {
  const { headerName, token } = await fetchCsrfToken();
  const response = await fetchApi("/logout", { method: "POST", headers: { [headerName]: token } });
  if (!response.ok) {
    throw new ApiError(response.status, "Signing out failed");
  }
}

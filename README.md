# Heaped & Stacked: the web app

A gym for your brain. Programmers pick **muscles** (topics, e.g. Java concurrency) and train on
**exercises** (open questions): they write their own answer first, then compare it with a model
answer and with their earlier attempts. Members can also write exercises and muscles, and the
people who own a muscle decide what goes live on it.

This repository is the single-page web app (React). It talks to the Heaped & Stacked API, a
Spring Boot service in its own repository, for everything: accounts, content and training.

- **Start here:** [Run it locally](#run-it-locally), then [How it's built](#how-its-built).
- **Before you change the UI:** read [CLAUDE.md](CLAUDE.md): the vocabulary, the file layout and
  the design rules (themes, colours, accessibility). It's written for AI assistants, but it's the
  most complete guide for people too.

## What's in the app

| Page             | Path                                                           | Who                                  | What it does                                                                                                                              |
| ---------------- | -------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Landing          | `/`                                                            | everyone                             | the pitch; picking muscles happens in the workout bar on every page                                                                       |
| Training rack    | `/train`                                                       | everyone; saving a set needs sign-in | one exercise at a time: write your set, submit, see the model answer, your previous sets, rate yourself and the exercise                  |
| Past workouts    | `/workouts`                                                    | signed in                            | history: sets, a calendar, your most trained muscles                                                                                      |
| Coach's Corner   | `/coach?tab=…`                                                 | signed in                            | add exercises and muscles, your exercises (with votes), TO APPROVE (exercises others add to your muscles), feedback (praise and problems) |
| Exercise preview | `/rack/$questionId`                                            | signed in, own exercises             | an exercise on the rack, as athletes see it                                                                                               |
| Locker Room      | `/locker-room`                                                 | signed in                            | your display name, sign out, delete your account                                                                                          |
| Front desk       | `/front-desk`                                                  | admins only (a 404 for anyone else)  | roles (athlete, gym staff, head coach) and blocking                                                                                       |
| Site pages       | `/about`, `/privacy`, `/terms`, `/code-of-conduct`, `/contact` | everyone                             | the footer pages; their facts come from `src/site.ts`                                                                                     |

The gym words are UI only: the API speaks of concepts (muscles), questions (exercises) and answers
(sets). CLAUDE.md has the full table.

## Run it locally

You need Node.js 24 (as CI uses) and npm.

1. **The API**, running on http://localhost:8080 (see the API's README), configured with
   `APP_UI_URL=http://localhost:5173` (the only origin it accepts, and where GitHub sign-in
   returns) and `API_DOCS_ENABLED=true` (only needed for `npm run api:types`).
2. **The web app:**

   ```sh
   npm install
   npm run dev
   ```

3. Open http://localhost:5173. Port 5173 is fixed (`strictPort`): the API rejects any other.

### Mock mode: no API, no GitHub

```sh
npm run dev:mock
```

Runs the app against a pretend API (`src/mocks`, built with MSW) with sample muscles, exercises,
sets, reports and members, signed in as `mock_coach`, a head coach. "Sign in" and "Sign out" work
without GitHub (signing out is remembered in localStorage under `hs-mock-signed-out`). Changes
live until the page reloads. Use it to try UI changes quickly; test against the real API before
committing anything that talks to it.

## Configuration

Nothing here is secret: it all ends up in the browser.

**The Docker image is the same in every environment.** Its container takes the addresses when it
starts, from two environment variables, and writes them into `/config.js` and the link-preview
tags of `index.html` (`docker/40-hs-config.sh`); the Content-Security-Policy takes the same API
address:

| Variable (container) | What it is                                                            |
| -------------------- | --------------------------------------------------------------------- |
| `API_URL`            | the API's address as the browser sees it, e.g. `https://api.<domain>` |
| `SITE_URL`           | the web app's own address, for the link-preview tags                  |

**In development** (`npm run dev`, mock mode), `public/config.js` is empty and these apply:

| Variable (build) | Where it's set                  | What it is                      |
| ---------------- | ------------------------------- | ------------------------------- |
| `VITE_API_URL`   | `.env.development`, `.env.mock` | the API's address               |
| `VITE_SITE_URL`  | the same                        | the web app's own address       |
| `VITE_MOCK_API`  | `.env.mock`                     | `true` runs against `src/mocks` |

**Before release, fill in `src/site.ts`:** the owner's name, contact address, hosting provider and
region, country, dates and the coffee link. The footer pages show them, as `[...]` until filled
in.

## Scripts

| Script              | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | Dev server with hot reload on port 5173                              |
| `npm run dev:mock`  | The same, against the pretend API in `src/mocks` (no backend needed) |
| `npm run build`     | Type-check, then build static files into `dist/`                     |
| `npm run typecheck` | Type-check only                                                      |
| `npm run format`    | Format `src/` with Prettier (CI checks it)                           |
| `npm run api:types` | Regenerate `src/api/schema.d.ts` from the running API's OpenAPI spec |

## How it's built

**Stack:** Vite, React 19, TypeScript, Tailwind CSS 4, TanStack Router (routes defined in code,
`src/router.tsx`) and TanStack Query (server state), openapi-fetch (typed API calls). Fonts ship
with the app (Fontsource). No component library: the building blocks are in
`src/components/ui.tsx`.

**Talking to the API** (`src/api/`):

- `schema.d.ts` is **generated** from the API's OpenAPI spec (`npm run api:types`); `types.ts`
  derives the types the pages use. After an API change, regenerate and let `npm run typecheck`
  point at every place to update.
- `client.ts` is the only HTTP code. The session is an HTTP-only cookie set by the API; the app
  never sees a token. Every write fetches a CSRF token from `GET /csrf` first and sends it in
  `X-CSRF-TOKEN`. Errors become `ApiError`, with the API's message and its `X-Request-Id`; for
  server errors (5xx) the message shows that id as "ref …", for bug reports.
- `queries.ts` has one React Query hook per API call; pages never call `fetch` themselves.
- Signing in is a full-page trip to GitHub; `signInAndReturnTo(path)` comes back to where you
  were (a visitor's draft answer survives it).

**Look and feel:** a dark theme (the default) and a light one, built from colour tokens in
`src/styles.css` (a token per role, with a value per theme). Every page is checked for phone
widths, keyboard use and WCAG AA contrast in both themes; the rules for keeping it that way are in
CLAUDE.md.

**Production build:** the Dockerfile builds the bundle and serves it with nginx
(`nginx.conf.template`):

- single-page routing (every path serves `index.html`)
- long-cached hashed assets
- gzip
- security headers: a strict Content-Security-Policy (only the site itself, the API and GitHub
  avatars), HSTS, nosniff, Referrer-Policy and Permissions-Policy.

The CSP allows the one inline script in `index.html` (the theme switch before first paint) by its
hash. If that script changes, update the hash: the template says how.

## CI and releases

`.github/workflows/ci.yml`, on every push to `master` and every pull request: type-check,
formatting, build, `npm audit` (high and above). On pushes to `master` and version tags (`v1.0.0`),
it then publishes the Docker image to GitHub Container Registry, tagged `sha-<commit>`, `latest`
and the version. The same image runs in every environment (it takes its addresses when it starts),
so the image tested in the test environment is the one promoted to production.
Dependabot proposes dependency updates weekly.

## Common tasks

- **A new page:** create it in `src/pages/`, add a route with its tab title in `src/router.tsx`,
  and link to it.
- **A new API call:** add a hook in `src/api/queries.ts` (wrap the call in `call()`), with the
  types from `src/api/types.ts`.
- **The API changed:** run the API with `API_DOCS_ENABLED=true`, then `npm run api:types` and
  `npm run typecheck`. Update `src/mocks` too, so mock mode keeps working.
- **A new colour:** add a token with a value for each theme in `src/styles.css`; never a raw colour
  in a component. Check its contrast in both themes.

## Troubleshooting

- **The API refuses every call (CORS):** the app must run on exactly http://localhost:5173, and
  the API's `APP_UI_URL` must match.
- **Sign-in doesn't come back to the app:** the GitHub OAuth App's callback URL must be
  `http://localhost:8080/login/oauth2/code/github` (the API's address).
- **"ref …" in an error message:** that's the API's request id; search the API's logs for it.
- **Something loads in dev but is blocked in the Docker image:** the Content-Security-Policy
  (`nginx.conf.template`) only allows the site itself, the API and GitHub avatars. Ship files with
  the app instead of loading them from elsewhere.
- **Fonts blocked as `data:` URLs:** `vite.config.ts` keeps font files from being inlined; keep it
  that way, or the CSP blocks them.

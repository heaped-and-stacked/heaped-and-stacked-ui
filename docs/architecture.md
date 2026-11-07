# Architecture

A React single-page app. It talks to the
[API](https://github.com/heaped-and-stacked/heaped-and-stacked-service) for everything: accounts,
content and training. The API speaks of concepts, questions and answers; the gym words live only
here ([CLAUDE.md](../CLAUDE.md) has the full table).

## Pages

| Page | Path | Who | What it does |
| ---- | ---- | --- | ------------ |
| Landing | `/` | everyone | the pitch; muscles are picked in the workout bar on every page |
| Training rack | `/train` | everyone; saving a set needs sign-in | one exercise at a time: write a set, submit, compare with the sample set, rate yourself and the exercise |
| Past workouts | `/workouts`, `/workouts/$questionId` | signed in | sets, a calendar, the most trained muscles, reviewing one exercise's sets |
| Coach's Corner | `/coach?tab=…` | signed in | your exercises, the inbox (approvals, feedback); in reviewer mode, your muscles and the gym's |
| Muscle page | `/coach/muscles/$tag` | those who curate it | one muscle's workload and actions |
| Exercise page | `/coach/exercises/new`, `/coach/exercises/$questionId` | signed in | add or edit an exercise |
| Locker Room | `/locker-room` | signed in | your display name, sign out, delete your account |
| Front Desk | `/front-desk` | admins only | the gym's numbers, roles, blocking, invites |
| Site pages | `/about`, `/privacy`, `/terms`, `/code-of-conduct`, `/contact` | everyone | the footer pages; their facts come from `src/site.ts` |

**Reviewer mode** separates using the gym from curating it. Whoever curates gets a switch in the top
bar: off, they see exactly what a member sees; on, the curating tools appear. It changes only what
the screens show. The API's rules are the same either way.

## Code layout

```
src/
  main.tsx        app start: React Query client and router
  router.tsx      every route, defined in code, with its tab title
  styles.css      design tokens (colours per theme, fonts)
  labels.ts       how API values and scales are shown
  site.ts         the facts the footer pages state
  api/            everything that talks to the API
  mocks/          the pretend API for mock mode
  components/     the frame around every page, and the building blocks (ui.tsx)
  pages/          one file per page; coach/ and rack/ for the larger ones
```

## Talking to the API

- `api/schema.d.ts` is **generated** from the API's OpenAPI spec, and `api/types.ts` derives the
  types pages use. After an API change, regenerating lets the compiler point at every place to update.
- `api/client.ts` is the only HTTP code. Errors become `ApiError`, with the API's message and its
  `X-Request-Id`. For server errors (5xx) the message shows that id as "ref …", for bug reports.
- `api/queries.ts` has one React Query hook per API call. Pages never call `fetch` themselves.

## Signing in

The session is an HTTP-only cookie set by the API, so the app never sees a token. Every write fetches
a CSRF token from `GET /csrf` first and sends it in `X-CSRF-TOKEN`. Signing in is a full-page trip to
GitHub, and `signInAndReturnTo(path)` comes back to where you were, so a visitor's draft answer
survives it.

## Production build

The Dockerfile builds the bundle and serves it with nginx (`nginx.conf.template`): single-page
routing, long-cached hashed assets, gzip, and security headers.

**The same image runs in every environment.** The container takes its addresses when it starts,
from `API_URL` and `SITE_URL`, and writes them into `/config.js` and the link-preview tags of
`index.html` (`docker/40-hs-config.sh`). The image that was tested is the one that goes live.

**Security headers:** a strict Content-Security-Policy that allows only the site itself, the API and
GitHub avatars, plus HSTS, nosniff, Referrer-Policy and Permissions-Policy. The one inline script in
`index.html`, the theme switch before first paint, is allowed by its hash: if it changes, update the
hash, as the template explains. User text is always rendered as text, never as HTML.

## Decisions

- **A plain single-page app, no server rendering.** The app is interactive from the first screen, so a
  static bundle is simpler to build and run.
- **No component library.** The look is specific and the set of components small, so the building
  blocks live in `components/ui.tsx`.
- **Generated API types.** No hand-written copies of API shapes that can drift apart.
- **Everything ships with the app.** Fonts come from Fontsource packages, so no visitor's address
  goes to a third party, and the Content-Security-Policy stays strict.
- **Syntax colours from a small regex pass,** not a library, since exercises need only a few languages.

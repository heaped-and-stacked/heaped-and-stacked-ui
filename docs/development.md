# Development

## Run it locally

You need Node.js 24 or newer, and npm.

### Mock mode: no API, no GitHub

```sh
npm install
npm run dev:mock
```

The app runs against a pretend API (`src/mocks`, built with MSW) with sample muscles, exercises, sets,
reports and members, signed in as `mock_coach`, a head coach. Signing in and out works without GitHub.
Changes last until the page reloads. Use it to try UI changes quickly, and test against the real API
before committing anything that talks to it.

### Against the real API

1. Run the [API](https://github.com/heaped-and-stacked/heaped-and-stacked-service/blob/master/docs/development.md)
   on http://localhost:8080, with `APP_UI_URL=http://localhost:5173`, the only origin it accepts, and
   where GitHub sign-in returns.
2. Run the app:

   ```sh
   npm install
   npm run dev
   ```

3. Open http://localhost:5173. The port is fixed, since the API rejects any other.

## Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm run dev:mock` | The same, against the pretend API |
| `npm run build` | Type-check, then build static files into `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run format` | Format `src/` with Prettier (CI checks it) |
| `npm run api:types` | Regenerate `src/api/schema.d.ts` from the running API's OpenAPI spec |

## Settings

Nothing here is secret: it all ends up in the browser.

**In the container**, set when it starts:

| Variable | What it is |
| -------- | ---------- |
| `API_URL` | the API's address as the browser sees it, e.g. `https://api.<domain>` |
| `SITE_URL` | the web app's own address, for the link-preview tags |

**In development**, `public/config.js` is empty and these apply:

| Variable | Where it's set | What it is |
| -------- | -------------- | ---------- |
| `VITE_API_URL` | `.env.development`, `.env.mock` | the API's address |
| `VITE_SITE_URL` | the same | the web app's own address |
| `VITE_MOCK_API` | `.env.mock` | `true` runs against `src/mocks` |

**`src/site.ts`** holds the facts the footer pages state: who runs the site, contact, country, dates
and the donation link.

## Common tasks

- **A new page:** create it in `src/pages/`, add a route with its tab title in `src/router.tsx`, and
  link to it.
- **A new API call:** add a hook in `src/api/queries.ts`, wrapping the call in `call()`, with the
  types from `src/api/types.ts`.
- **The API changed:** run the API with `API_DOCS_ENABLED=true`, then `npm run api:types` and
  `npm run typecheck`. Update `src/mocks` too, so mock mode keeps working.
- **A new colour:** add a token with a value for each theme in `src/styles.css`, and check its
  contrast in both themes.

## Builds and releases

`.github/workflows/ci.yml` runs on every push to `master` and `release/**` branches and every pull
request: type-check, formatting, build, and `npm audit` (high and above). On those pushes and on
version tags (`v1.0.0`), it then publishes the Docker image to GitHub Container Registry, tagged `sha-<commit>`,
`latest` and the version.

To release a version, tag the commit, wait for CI, deploy that tag, and publish the changes on the
[Releases page](https://github.com/heaped-and-stacked/heaped-and-stacked-ui/releases).

Dependencies are updated by hand, now and then (`npm outdated`). GitHub's security alerts flag a
vulnerable one.

## Troubleshooting

- **The API refuses every call (CORS):** the app must run on exactly http://localhost:5173, and the
  API's `APP_UI_URL` must match.
- **Sign-in doesn't come back to the app:** the GitHub OAuth App's callback URL must be
  `http://localhost:8080/login/oauth2/code/github`, the API's address.
- **"ref …" in an error message:** that's the API's request id; search the API's logs for it.
- **Something loads in dev but is blocked in the Docker image:** the Content-Security-Policy allows
  only the site itself, the API and GitHub avatars. Ship files with the app instead of loading them
  from elsewhere.
- **Fonts blocked as `data:` URLs:** `vite.config.ts` keeps font files from being inlined; keep it
  that way, or the Content-Security-Policy blocks them.

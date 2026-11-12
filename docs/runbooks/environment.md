---
type: runbook
description: Read when adding, changing or debugging an environment variable, or deploying to an Arcade Club environment.
version: 4.1.0
---

# Environment contract

[`env.manifest.ts`](../../env.manifest.ts) is data only: which value each web, mobile,
Convex and CI consumer reads, under which name, in which environment. The shared
[environments standard](../standards/environments.md) decides where each value lands
and which Infisical tier each environment reads. This app has one exception to it, also
in the [project decisions](../../CODING_STANDARDS.md#project-decisions): the installed
preview app calls the staging backend, not production
([below](#exception-the-preview-app-uses-staging)).

| Environment | Web | Convex | EAS | Infisical |
| --- | --- | --- | --- | --- |
| `local` | `pnpm dev`, `.env.local` | the worktree's backend, else `zany-parakeet-507` | `development` | `dev` |
| `dev` | Worker `games-dev` | `zany-parakeet-507` | `development` | `dev` |
| `preview` | Worker `games-pr-<n>` | per-PR preview | | `staging` |
| `staging` | Worker `games-staging` (`arcade-club-stg.appelent.nl`) | `blessed-blackbird-8` (web and preview app) | `preview` | `prod` |
| `production` | Worker `games` | `chatty-ram-217` | `production` | `prod` |

## Source

Values live in the shared Infisical project (`.infisical.json` holds only its id). The
lookup order is `/`, then `/arcade-club`; a value in the app folder overrides the root.
`/arcade-club` holds the app's own values: `convex-url`, `convex-deploy-key`,
`sentry-dsn`, `sentry-auth-token` and `web-origin`, plus `convex-staging-deploy-key`,
`convex-staging-url` and `web-staging-origin` in `prod`.

Infisical tiers follow lifetime. Local, dev, cloud worktrees and web PR previews are
short-lived and use the Clerk development instance: Infisical `staging /` holds
`clerk-publishable-key` and `clerk-jwt-issuer-domain` as secret references to the `dev`
values, so the per-PR web build gets `pk_test_` and every per-PR Convex backend trusts
the development issuer (a Convex `preview` default). `staging /arcade-club` holds a
preview-kind `convex-deploy-key` for the per-PR web backends. `staging` is long-lived
and reads Infisical `prod` like production: production Clerk, with its own backend URL
and web origin. It is two things: the staging web, a merge's first stop, on its own Convex
deployment with its own `prod:` key (`/arcade-club` `convex-staging-deploy-key` in
`prod`); and the installed preview app, written to EAS `preview` by
`pnpm env:apply staging --only eas`, which calls that same staging backend.

### Exception: the preview app uses staging

The shared standard points the installed preview app at the production backend. Here
it calls staging, so a phone build never touches production data (Eric, 2026-11-12,
APP-9). Which backend each variant uses:

| Variant | EAS environment and channel | Convex | Clerk | Share links |
| --- | --- | --- | --- | --- |
| Production (`com.appelent.arcadeclub`) | `production` | `chatty-ram-217` | production (`pk_live_`) | `arcade-club.appelent.nl` |
| Preview (`com.appelent.arcadeclub.preview`) | `preview` | `blessed-blackbird-8` | production (`pk_live_`) | `arcade-club-stg.appelent.nl` |
| Development (`com.appelent.arcadeclub.dev`) | `development` | `zany-parakeet-507` | development (`pk_test_`) | Infisical `dev` `web-origin` |

The manifest does this with two staging-only entries in Infisical `prod
/arcade-club`: `convex-staging-url` (the staging deployment's `.convex.cloud` URL) lands
as `EXPO_PUBLIC_CONVEX_URL`, and `web-staging-origin`
(`https://arcade-club-stg.appelent.nl`) as `EXPO_PUBLIC_WEB_ORIGIN`, in EAS `preview`.
Clerk stays production: the staging web already signs in on it, and the staging
deployment trusts its issuer. Both values are inlined in the JavaScript bundle, not the
native runtime, so an over-the-air update moves installed preview builds over; a
build only needs replacing if its runtime is already behind main's (see
[mobile.md](mobile.md#over-the-air-updates)). `deploy.yml` publishes that update after
each staging deploy.

Static commands need no Infisical login:

```sh
pnpm env:check
pnpm env:generate   # rewrites .env.example
```

Provider reads and writes are explicit. Inspect the plan first:

```sh
pnpm env:plan production
pnpm env:apply production --only eas
```

## Local and worktrees

Every worktree is prepared by `node scripts/workspace.mjs prepare --editor <host>`
([workspaces](../standards/workspaces.md)); `t3.json` runs it when T3 Code creates a
worktree. It writes `.env.local` and `apps/mobile/.env.local` from Infisical `dev`,
then, per `appelent.json` (`backend.mode: "cloud"`), creates the worktree's own Convex
deployment, applies its Convex values, pushes the functions and writes its URL into
both files. `node scripts/workspace.mjs clean` removes what prepare created. Never copy
dotenv files between checkouts; in the main checkout, `pnpm env:apply local --only
file` regenerates them.

Generated files hold only manifest values. To add one, add it to the manifest.
`EXPO_PUBLIC_SENTRY_DEBUG` (Infisical `sentry-debug`, optional) is the one local-only
toggle: `1` lets a development bundle report to Sentry.

## Deployed environments

Deployed environments read values from their destination, never from a
`.env.<environment>.local` file.

- `production`: `pnpm env:apply production --only github` writes the deploy workflow's
  values into the `production` GitHub Environment: secrets `CONVEX_DEPLOY_KEY` (a
  `prod:` key for `chatty-ram-217`), `CLOUDFLARE_API_TOKEN`, `SENTRY_AUTH_TOKEN`, and
  variables `CLOUDFLARE_ACCOUNT_ID`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`.
  The workflow refuses a key without the `prod:` prefix and a build whose Worker is
  not `games`.
- `staging`: `pnpm env:apply staging --only github` writes the same names into the
  `staging` GitHub Environment, with `CONVEX_DEPLOY_KEY` from
  `convex-staging-deploy-key`; `--only convex` sets `CLERK_JWT_ISSUER_DOMAIN` on the
  staging deployment. The workflow refuses a build whose Worker is not
  `games-staging`.
- `preview`: `pnpm env:apply preview --only github` writes repository scope, always as
  `PREVIEW_<name>`, so a missing Environment value never falls back to a preview one.
  `preview.yml` maps them back (`CONVEX_DEPLOY_KEY: ${{ secrets.PREVIEW_CONVEX_DEPLOY_KEY }}`);
  `deploy.yml`'s mobile update and `eas-local-build.yml` read `PREVIEW_EXPO_TOKEN`.
- `dev`: the build values land in the `dev` GitHub Environment; no workflow deploys
  dev.

Local deploys and over-the-air publishes take their values from Infisical through
`env:exec`, which writes nothing:

```sh
pnpm deploy:dev          # push Convex to the shared dev deployment (zany-parakeet-507), build games-dev (CLOUDFLARE_ENV=dev), wrangler deploy
pnpm deploy:staging      # same as a merge: staging Convex + build (CLOUDFLARE_ENV=staging), wrangler deploy
pnpm deploy:production   # same as a production run: convex deploy + build, wrangler deploy
pnpm mobile:update:preview
```

`ship:dev` names the dev deployment itself and clears `CONVEX_DEPLOY_KEY`. Without that,
the Convex CLI would push to whatever `.env.local` selects, which in a prepared worktree
is the worktree backend and its scoped key. `convex dev` also rewrites `.env.local` for
the deployment it pushed to, so `ship:dev` runs it through `scripts/keep-env-local.mjs`,
which puts the file back exactly as it was.

## Convex deployment values

`pnpm exec convex env list` (add `--prod` for production) shows a deployment's values.
`CLERK_JWT_ISSUER_DOMAIN` is required on every Convex deployment: dev, staging, prod, and as a
`preview` type default (`convex env default set ... --type preview`, written by
`pnpm env:apply preview --only convex`, trusting the Clerk development issuer). Without
it Convex never validates the Clerk JWT and `ctx.auth.getUserIdentity()` silently
returns `undefined`.

## Supplied values

Some placements are produced by tools, not copied from Infisical:

- `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` in `.env.local`, and
  `EXPO_PUBLIC_CONVEX_URL` in `apps/mobile/.env.local`, come from workspace prepare (or
  `pnpm exec convex dev`). On a physical device, point the mobile URL at a deployment
  the phone can reach (see [mobile.md](mobile.md)).
- The preview and deploy workflows get `VITE_CONVEX_URL` from `convex deploy`.

The test-user email and password are public client values (Vite and Metro inline
them) and land only in local and dev. The engine records only variable names in
`.appelent/env-state.json` (ignored by Git).

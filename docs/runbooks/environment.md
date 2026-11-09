---
type: runbook
description: Read when adding, changing or debugging an environment variable, or deploying to an Arcade Club environment.
version: 2.0.0
---

# Environment contract

[`env.manifest.ts`](../../env.manifest.ts) is data only: which value each web, mobile,
Convex and CI consumer reads, under which name, in which environment. The shared
[environments standard](../standards/environments.md) decides where each value lands
and which Infisical tier each environment reads. This app has no exceptions to it.

| Environment | Web | Convex | EAS | Infisical |
| --- | --- | --- | --- | --- |
| `local` | `pnpm dev`, `.env.local` | the worktree's backend, else `zany-parakeet-507` | `development` | `dev` |
| `dev` | Worker `games-dev` | `zany-parakeet-507` | `development` | `dev` |
| `preview` | Worker `games-pr-<n>` | per-PR preview (web); `chatty-ram-217` (iOS app) | `preview` | `staging` |
| `production` | Worker `games` | `chatty-ram-217` | `production` | `prod` |

## Source

Values live in the shared Infisical project (`.infisical.json` holds only its id). The
lookup order is `/`, then `/arcade-club`; a value in the app folder overrides the root.
`/arcade-club` holds the app's own values: `convex-url`, `convex-deploy-key`,
`sentry-dsn`, `sentry-auth-token` and `web-origin`.

Auth follows lifetime. Local, dev, cloud worktrees and web PR previews are short-lived
and use the Clerk development instance; the installed preview iOS app and production are
long-lived and use the production instance. So `staging` carries the production Clerk
key and issuer for the iOS app, while web PR previews read `pr-clerk-publishable-key`
and `pr-clerk-jwt-issuer-domain` (in `staging /`, secret references to the `dev`
values): the per-PR web build gets `pk_test_` and every per-PR Convex backend trusts
the development issuer (a Convex `preview` default). `staging /arcade-club` holds the
production backend URL and web origin for the iOS app, and a preview-kind
`convex-deploy-key` for the per-PR web backends.

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
pnpm deploy:production   # same as CI: convex deploy + build, wrangler deploy
pnpm mobile:update:preview
```

`ship:dev` names the dev deployment itself and clears `CONVEX_DEPLOY_KEY`. Without that,
the Convex CLI would push to whatever `.env.local` selects, which in a prepared worktree
is the worktree backend and its scoped key. `convex dev` also rewrites `.env.local` for
the deployment it pushed to, so `ship:dev` runs it through `scripts/keep-env-local.mjs`,
which puts the file back exactly as it was.

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

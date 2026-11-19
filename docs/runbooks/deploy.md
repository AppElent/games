---
type: runbook
description: Read when deploying Arcade Club, or changing the CI, deploy, preview or mobile build workflows.
version: 3.0.0
---

# Deploy

Project facts for the [deployments](../standards/deployments.md),
[previews](../standards/previews.md) and [releases](https://github.com/AppElent/developer-home/blob/main/standards/releases.md) standards. Values and GitHub Environments are in
[environment](environment.md); mobile builds and updates in [mobile](mobile.md).

## Project facts

| Fact | Value |
| --- | --- |
| Workers | `games` (production, `arcade-club.appelent.nl`), `games-staging` (`CLOUDFLARE_ENV=staging`, `arcade-club-stg.appelent.nl`), `games-dev` (`CLOUDFLARE_ENV=dev`), `games-pr-<n>` (previews) |
| Convex | `chatty-ram-217` (production), `blessed-blackbird-8` (`eric-jansen:games:staging`), `zany-parakeet-507` (dev) |
| Quality gate | `.github/workflows/ci.yml`, job `check`; the `main` ruleset requires it and a PR for every change |
| Shared job setup | `.github/actions/setup` (pnpm, Node version, frozen install) after each checkout; bump Node there |
| Local fallback | `pnpm run deploy:staging`, `pnpm run deploy:production` (= `pnpm run deploy`), `pnpm run deploy:dev` |

## Workflows

- `deploy.yml`: every push to `main` ships, one merge at a time. It reruns CI, then
  runs `deploy-target.yml` for staging (the staging Convex deployment and the
  `games-staging` Worker from the `staging` GitHub Environment), then for production
  (production Convex and the `games` Worker from the `production` Environment), then
  publishes the preview app's OTA update when an installed build can load it
  (`apps/mobile/scripts/ci-publish-update.mjs preview`, repo secret
  `PREVIEW_EXPO_TOKEN`), because that app calls the production backend. Each target
  ends with a smoke check: `/version` must report the run's commit within two
  minutes, and `/` must answer 200. Production runs only after staging passed. No
  job waits for a person: the merge is the gate, so a change that could break
  installed app builds, or is `high`, waits for Eric before merging. "Run workflow"
  on `main` redeploys `main` through the same chain; don't dispatch it for a merge
  that is already shipping.
- `mobile-update-production.yml`: once a day (05:30 UTC) publishes the production
  app's OTA update; see [mobile](mobile.md#over-the-air-updates).
- `preview.yml`: per-PR Convex and Worker preview, opt-in with the `preview:web`
  label, reading repository-scope `PREVIEW_<name>` values. A preview starts from an
  empty Convex backend and needs no seed: the only reference data, the sample quiz, is
  created on demand by `quiz.ensureSampleSet`.
- `mobile-runtime.yml` comments on each mobile PR whether it changes the runtime
  fingerprint; `mobile-build.yml` and `eas-local-build.yml` build the app on a runner
  (`eas build --local`) for PRs labelled `build:ios`/`build:android` or a manual run.
- `dependabot-blast-radius.yml` is the toolkit labeler template, copied unchanged
  (rules in [dependency updates](../standards/dependency-updates.md)): a PR whose
  every update is a patch gets `blast-radius:low`; anything else, or a change under
  `.github/`, gets `blast-radius:med`. It swaps only those two labels and skips a PR
  marked `blast-radius:high`.

## Versions and releases

- The version is `expo.version` in `apps/mobile/app.json` (SemVer), for web and the
  app alike. Bump `MINOR` for each store build, `PATCH` for a hotfix store build; web
  deploys and OTA updates don't bump it.
- `GET /version` on each Worker returns `app`, `version`, `commit`, `release`,
  `environment` and `deployedAt` (the deploy run's build stamp, which the smoke check
  compares). `src/server.ts` answers it before the
  app and Sentry; `vite.config.ts` sets the values.
- Sentry release: `arcadeclub@<version>+<short sha>` for the browser bundle, the
  Worker, and OTA updates (`publish-update.mjs` inlines the commit as
  `EXPO_PUBLIC_GIT_COMMIT`). A build's embedded bundle keeps the SDK's native release.
- Tags: `ota-preview` (moved by `deploy.yml`), `ota-production` (moved by the daily
  job), and `v<version>` on the commit of each store build. Web deploys need no tags.
- A red smoke check leaves the new Convex functions and Worker live; nothing rolls
  back on its own. Roll back the Worker with `pnpm exec wrangler rollback` (production
  is the top-level `games` Worker; add `--env staging` for staging), then revert on
  `main` so the fix ships like any merge. Convex has no rollback: fix forward, which
  the backward-compatibility rule keeps safe for installed apps. Roll back an app
  update with `eas update:rollback` on the channel, then fix forward.
- Don't re-run an old Deploy run: a re-run whose commit is no longer the head of
  `main` fails on purpose, because it would put older code on production. Use "Run
  workflow" on `main`.

## Verify

- `curl -s https://arcade-club.appelent.nl/version` reports the commit at the head
  of `main` once its Deploy run is green; staging the same on
  `arcade-club-stg.appelent.nl`.
- `jq -r .name dist/server/wrangler.json` after a build prints the Worker the deploy
  expects.

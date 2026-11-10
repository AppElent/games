---
type: runbook
description: Read when deploying Arcade Club, or changing the CI, deploy, preview or mobile build workflows.
version: 1.0.0
---

# Deploy

Project facts for the [deployments](../standards/deployments.md) and
[previews](../standards/previews.md) standards. Values and GitHub Environments are in
[environment](environment.md); mobile builds and updates in [mobile](mobile.md).

## Project facts

| Fact | Value |
| --- | --- |
| Workers | `games` (production), `games-dev` (`CLOUDFLARE_ENV=dev`), `games-pr-<n>` (previews) |
| Quality gate | `.github/workflows/ci.yml`, job `check`; the `main` ruleset requires it and a PR for every change |
| Shared job setup | `.github/actions/setup` (pnpm, Node version, frozen install) after each checkout; bump Node there |
| Local fallback | `pnpm run deploy:production` (= `pnpm run deploy`), `pnpm run deploy:dev` |

## Workflows

- `deploy.yml`: a push to `main` (or "Run workflow") reruns CI, then deploys
  production Convex and the `games` Worker from the `production` GitHub Environment,
  then publishes the preview app's OTA update when an installed build can load it
  (`apps/mobile/scripts/ci-publish-update.mjs`, repo secret `PREVIEW_EXPO_TOKEN`).
- `preview.yml`: per-PR Convex and Worker preview, opt-in with the `preview:web`
  label, reading repository-scope `PREVIEW_<name>` values. A preview starts from an
  empty Convex backend and needs no seed: the only reference data, the sample quiz, is
  created on demand by `quiz.ensureSampleSet`.
- `mobile-runtime.yml` comments on each mobile PR whether it changes the runtime
  fingerprint; `mobile-build.yml` and `eas-local-build.yml` build the app on a runner
  (`eas build --local`) for PRs labelled `build:ios`/`build:android` or a manual run.

## Verify

- `jq -r .name dist/server/wrangler.json` after a build prints the Worker the deploy
  expects.

---
type: runbook
description: Read when running, verifying or building the Arcade Club mobile app (apps/mobile).
version: 2.0.0
---

# Mobile app

## Identity

| Variant | `APP_VARIANT` | App id | Scheme |
| --- | --- | --- | --- |
| Production | `production` | `com.appelent.arcadeclub` | `arcadeclub` |
| Preview | `preview` | `com.appelent.arcadeclub.preview` | `arcadeclub-preview` |
| Development | `development` (or unset locally) | `com.appelent.arcadeclub.dev` | `arcadeclub-dev` |

`apps/mobile/app.config.ts` maps the variant; `eas.json` sets it per profile. EAS
project: `@appelent/arcadeclub` (id in `app.json`).

Preview and development builds carry a blue PREVIEW or orange DEV label on the
icon. After changing `assets/icon.png` or `assets/adaptive-icon.png`, regenerate
the labelled copies with `swift apps/mobile/scripts/badge-icons.swift` (macOS).
Icon changes need a new build; an EAS Update can't change the home-screen icon.

## Environment

`apps/mobile/.env.local` is generated from [`env.manifest.ts`](../../env.manifest.ts) by workspace prepare or `pnpm env:apply local --only file` (see [environment.md](environment.md)); don't edit it by hand:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | The worktree's backend, written by workspace prepare. On a physical device use a deployment it can reach, such as the dev deployment (`https://zany-parakeet-507.eu-west-1.convex.cloud`, as in the EAS `development` environment) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk instance as the web app; its Native API must be enabled |
| `EXPO_PUBLIC_WEB_ORIGIN` | Web origin for share links. Unset: invites share the room code only and challenge links are hidden |
| `EXPO_PUBLIC_TEST_USER_EMAIL` / `_PASSWORD` | Optional, `pk_test_` only: prefill sign-in |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional locally; EAS builds get it from the EAS environment (`pnpm env:apply`, see [environment.md](environment.md)) |
| `EXPO_PUBLIC_SENTRY_DEBUG` | `1` to report from a development bundle (Infisical `dev` `sentry-debug`, optional) |

## Run locally

```bash
pnpm exec convex dev                                   # root: backend
cd apps/mobile
APP_VARIANT=development pnpm exec expo run:android     # or run:ios; builds + installs the dev client
APP_VARIANT=development pnpm exec expo start --dev-client
```

With a local Convex backend (`EXPO_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`), an
Android emulator needs `adb reverse tcp:3210 tcp:3210` (and the Metro port) after
every emulator restart.

A phone can't reach `127.0.0.1`, so on a physical device use the dev deployment. The
bundle reads `EXPO_PUBLIC_*` from `apps/mobile/.env.local`; shell overrides don't apply.

Rebuild the dev client after adding a native module (any new `expo-*` package with
native code). JS-only changes reload through Metro.

Without Xcode, build the iOS simulator dev client on EAS and install the `.app`
from the build's artifact:

```bash
cd apps/mobile
pnpm exec eas build --platform ios --profile development-simulator
```

For a phone, the `development` profile builds an Android APK or an ad-hoc iOS build
for the devices registered with `eas device:create`. The first iOS build must run
interactively so EAS can sign in to Apple and create the provisioning profile; add
`--non-interactive` after that. Open the installed app, then connect it to
`pnpm exec expo start --dev-client` on the same network.

To install the preview app next to the dev app on an iPhone, build `preview-internal`
(ad-hoc, `com.appelent.arcadeclub.preview`) and open the build page on the phone. It
runs against production Clerk and Convex, so it only sees Convex changes once they're
deployed to production.

### TestFlight

The App Store Connect app is `6832923667` (`submit.production.ios.ascAppId` in
`eas.json`). Release with:

```bash
cd apps/mobile
pnpm exec eas build --platform ios --profile production --auto-submit
```

Production builds use production Clerk and Convex: deploy the backend first (see
[deploy.yml](../../.github/workflows/deploy.yml)). The `asc` CLI manages TestFlight
from the terminal (`asc status --app 6832923667`).

External testers join through the **Public** group's link,
`https://testflight.apple.com/join/M3bRpXCj`. Add each new build to that group
(`asc builds add-groups --app 6832923667 --latest --group 0a5928f2-2d89-49e6-890c-3e95512023af --submit --confirm`);
a new version needs Beta App Review again. The store name is "Arcade Club: Party
Games" because "Arcade Club" is taken. The review needs these App Store Connect fields:

| Field | Value |
| --- | --- |
| Privacy Policy URL (App Information) | `https://arcade-club.appelent.nl/privacy` |
| Beta App Description, What to Test | Plain description of the games; online play needs a second device or a guest |
| Feedback email | `privacy@appelent.nl` (Cloudflare Email Routing forwards it) |
| Sign-in for review | `appreview@appelent.nl` in production Clerk; its password is set in the Clerk dashboard |
| App Privacy | Email (account), name (display name), user ID, crash and diagnostic data; none used for tracking |

The policy page is `src/routes/privacy.tsx` with copy in the `privacy` messages; Profile
links to it. Profile → Delete account deletes the Arcade Club data and then the shared
Appelent Clerk user. If review deletes the reviewer account, recreate it before the
next submission. The song-timeline game ships as Music Timeline: never use the
trademarked name Hitster in visible copy or store metadata.

### CI builds

The **Mobile Build** workflow runs `eas build --local` on a GitHub runner, so it spends
no EAS Build credits. Add the `build:ios` or `build:android` label to a PR to build the
`development` profile on every push while the label stays, or start it from the Actions
tab with a platform and profile (`development` or `preview-internal`). The `.ipa`/`.apk`
is a workflow artifact for 14 days. It uses the `PREVIEW_EXPO_TOKEN` repo secret (Infisical
`expo-token`, written by `pnpm env:apply preview --only github`) and skips the Sentry
source-map upload; builds you ship stay on EAS cloud builds. For an iPhone, an EAS cloud
build is still the easiest install: its build page has an install QR code.

### Over-the-air updates

Ship JS-only changes to installed builds without rebuilding:

```bash
pnpm mobile:update:preview --message "…"
pnpm mobile:update:production --message "…"
```

`apps/mobile/scripts/publish-update.mjs` sets `APP_VARIANT` and `--environment` from
the channel, so the update's runtime matches that channel's builds, and uploads the
source maps. It refuses when no finished build on the channel has this checkout's
runtime, since nothing would load the update; `--without-build` overrides that. The root scripts add `SENTRY_AUTH_TOKEN` from Infisical through
`env:exec`. Production refuses to publish without it. If only the upload failed,
retry with `--upload-only`; don't publish again. A bare `eas update` resolves to the
development variant, so no preview or production build would ever load it.

CI follows the [releases](https://github.com/AppElent/developer-home/blob/main/standards/releases.md) standard; both channels use
`apps/mobile/scripts/ci-publish-update.mjs`:

- **Preview, every merge.** `deploy.yml` publishes `main` to `preview` once the
  production backend it calls is live. It publishes only for the platforms where a
  finished EAS build or an earlier update on `preview` has the runtime, skips when
  nothing the app bundles changed since the `ota-preview` tag, and otherwise says in
  the run summary that a rebuild is due. Local builds are not on EAS: after installing
  one with a new runtime, publish once by hand to seed the channel.
- **Production, once a day.** `mobile-update-production.yml` (05:30 UTC, or "Run
  workflow") publishes the newest commit that has been on `preview` for 24 hours,
  checked out in a worktree so the bundle is exactly what preview ran. It publishes
  only when the bundle changed since the `ota-production` tag, no newer preview
  update is a rollback, the latest `production` update and the newest `v*` tag are
  older than that commit (a hand hotfix or a store build is never downgraded), the
  production backend's `/version` reports that commit or a later one, and a
  production build or update has its runtime. Each skip is a line in the run summary.
- **Hold.** To stop the daily publish (a bad commit soaked on preview and its fix
  hasn't yet), set the repository variable `OTA_PRODUCTION_HOLD` to the reason; delete
  it to resume. Rolling back preview (`eas update:rollback --branch preview`) also
  holds production until a newer preview update replaces the rollback.
- GitHub turns off a scheduled workflow after 60 days without repository activity;
  re-enable `Mobile production update` in the Actions tab if that happens. **Store build due**
  means a native change: propose a store release on Eric's decision card (changelog:
  merged PR titles since the last `v` tag), tag `v<version>` on the build's commit,
  and never submit without his yes.
- After a production publish, check Sentry for release
  `arcadeclub@<version>+<short sha>` (JS errors from an update carry it; native
  crashes keep the build's native release). Commits published before this naming
  reached `main` report the SDK's default release. Roll back with `eas update:rollback` on the
  `production` branch and fix forward.

`pnpm mobile:update:production` stays for a hand publish (a hotfix that can't wait a
day); move the `ota-production` tag to its commit afterwards so the daily job
doesn't publish it again.

Builds pick up an update on their next cold start, when the runtime fingerprint
matches, or when the user taps **Restart** on the Play tab once one has downloaded. The
app also checks again on resume, at most hourly. `node apps/mobile/scripts/fingerprint.mjs` prints this checkout's runtime per
variant (the same value EAS shows on a build), and the **Mobile runtime** check
comments on each PR whether it changes it. `apps/mobile/fingerprint.config.js` leaves `package.json` scripts out of the
fingerprint, so editing one doesn't cut installed builds off from updates. Native
changes (a new native module, `app.json` plugins, icons) still need a new build.

## Verify on a device

Claim a simulator/emulator through `~/.agents/bin/sim`, then drive it with
`agent-device` (`open`, `press 'id="…"'`, `fill`, `snapshot -i`, `screenshot`).
Useful entry points:

- `arcadeclub-dev://join?code=ABCDEF` / `arcadeclub-dev://join?token=…`: join flows.
- `arcadeclub-dev://cards` / `arcadeclub-dev://cards/pesten`: card hub and game setup.
- `arcadeclub-dev://backgammon/local`, `arcadeclub-dev://hitster`.
- `settings appearance dark|light` and `settings text-size …` for theme and large
  text checks.

Hosting needs a signed-in user: set the test-account variables and sign in from
Profile. To add a second player, join from the CLI as a guest:

```bash
pnpm exec convex run sessions:joinByCode '{"joinCode":"ABCDEF","displayName":"CLI Guest","guestId":"cli-guest-1"}'
```

Without a test account, host from the CLI against the local deployment and join
from the device as a guest:

```bash
ID='{"subject":"cli-host","issuer":"https://<CLERK_JWT_ISSUER_DOMAIN>","tokenIdentifier":"cli-host"}'
pnpm exec convex run --identity "$ID" hitster:create \
  '{"title":"Test","displayName":"DJ CLI","mode":"original","packId":"normal","targetCards":10,"playbackMode":"hostDevice"}'
# then hitster:start / hitster:reveal / hitster:nextRound with the returned
# sessionId and participantId; backgammon:create '{"title":"Test","displayName":"CLI"}'
# opens a challenge, and a card room opens with
# cardGames:createTable '{"title":"Pesten","displayName":"CLI","seatSecret":"cli-seat-secret-0123456789abcdef","joinMode":"room","gameId":"pesten","options":[],"bots":0,"start":false}'.
```

## Error reporting

Sentry project `appelent/arcadeclub` (shared with web and Convex, see
[sentry.md](sentry.md)), set up in `src/observability/`. Preview and production builds
report errors and player feedback only, with no user data and no URL query strings.
Profile's **Report a problem** row or a shake opens the feedback form. The
environment is the EAS Update channel. Development bundles do not report, and
`Sentry.wrap` is skipped, unless `EXPO_PUBLIC_SENTRY_DEBUG=1`.

EAS builds upload source maps through the `@sentry/react-native/expo` plugin, using the
`SENTRY_AUTH_TOKEN` secret in the EAS environment. That and every public build value
come from Infisical through [`env.manifest.ts`](../../env.manifest.ts); see
[environment.md](environment.md). Never put the token in `EXPO_PUBLIC_*` or a tracked
file.

## Checks

The root `pnpm run check`, `pnpm run typecheck` and `pnpm test` cover web, `@arcadeclub/core`
and `@arcadeclub/mobile`; CI runs the same commands.

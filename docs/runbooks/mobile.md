---
type: runbook
description: Read when running, verifying or building the Arcade Club mobile app (apps/mobile).
version: 1.0.0
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

`apps/mobile/.env.local` (template: `apps/mobile/.env.example`):

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | The dev deployment (`https://zany-parakeet-507.eu-west-1.convex.cloud`, as in the EAS `development` environment), or a local backend the device can reach |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk instance as the web app; its Native API must be enabled |
| `EXPO_PUBLIC_WEB_ORIGIN` | Web origin for share links. Unset: invites share the room code only and challenge links are hidden |
| `EXPO_PUBLIC_TEST_USER_EMAIL` / `_PASSWORD` | Optional, `pk_test_` only: prefill sign-in |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional locally; EAS builds get it from the EAS environment (`pnpm env:apply`, see [environment.md](environment.md)) |
| `EXPO_PUBLIC_SENTRY_DEBUG` | `1` to report from a development bundle |

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

### Over-the-air updates

Ship JS-only changes to installed builds without rebuilding:

```bash
pnpm mobile:update:preview --message "…"
pnpm mobile:update:production --message "…"
```

`apps/mobile/scripts/publish-update.mjs` sets `APP_VARIANT` and `--environment` from
the channel, so the update's runtime matches that channel's builds, and uploads the
source maps. The root scripts add `SENTRY_AUTH_TOKEN` from Infisical through
`env:exec`. Production refuses to publish without it. If only the upload failed,
retry with `--upload-only`; don't publish again. A bare `eas update` resolves to the
development variant, so no preview or production build would ever load it.

Builds pick up an update on their next cold start, when the runtime fingerprint
matches. `apps/mobile/fingerprint.config.js` leaves `package.json` scripts out of the
fingerprint, so editing one doesn't cut installed builds off from updates. Native
changes (a new native module, `app.json` plugins, icons) still need a new build.

## Verify on a device

Claim a simulator/emulator through `~/.agents/bin/sim`, then drive it with
`agent-device` (`open`, `press 'id="…"'`, `fill`, `snapshot -i`, `screenshot`).
Useful entry points:

- `arcadeclub-dev://join?code=ABCDEF` / `arcadeclub-dev://join?token=…`: join flows.
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
pnpm exec convex run --identity "$ID" sessions:create \
  '{"gameType":"hitster","joinMode":"room","authPolicy":"guestAllowed","title":"Test","displayName":"DJ CLI"}'
# then hitster:setup / hitster:start / hitster:reveal / hitster:nextRound with the
# returned sessionId and host participantId; backgammon:createState for a challenge.
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

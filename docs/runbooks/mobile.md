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

`apps/mobile/app.config.ts` maps the variant; `eas.json` sets it per profile.
The EAS project is not linked yet: run `eas init` under the `appelent` owner before
the first cloud build.

## Environment

`apps/mobile/.env.local` (template: `apps/mobile/.env.example`):

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | Same deployment as the web app (`VITE_CONVEX_URL`) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk instance as the web app; its Native API must be enabled |
| `EXPO_PUBLIC_WEB_ORIGIN` | Web origin for share links. Unset: invites share the room code only and challenge links are hidden |
| `EXPO_PUBLIC_TEST_USER_EMAIL` / `_PASSWORD` | Optional, `pk_test_` only: prefill sign-in |

## Run locally

```bash
pnpm exec convex dev                                   # root: backend
cd apps/mobile
APP_VARIANT=development pnpm exec expo run:android     # or run:ios; builds + installs the dev client
APP_VARIANT=development pnpm exec expo start --dev-client
```

Rebuild the dev client after adding a native module (any new `expo-*` package with
native code). JS-only changes reload through Metro.

## Verify on a device

Claim a simulator/emulator through `~/.agents/bin/sim`, then drive it with
`agent-device` (`open`, `press 'id="…"'`, `fill`, `snapshot -i`, `screenshot`).
Useful entry points:

- `arcadeclub-dev://join?code=ABCDEF` / `arcadeclub-dev://join?token=…`: join flows.
- `arcadeclub-dev://backgammon/local`, `arcadeclub-dev://hitster`.
- `settings appearance dark|light` and `settings text-size …` for theme and large
  text checks.

Hosting needs a signed-in user. Without a test account on the device, host from the
CLI against the local deployment and join from the device as a guest:

```bash
ID='{"subject":"cli-host","issuer":"https://<CLERK_JWT_ISSUER_DOMAIN>","tokenIdentifier":"cli-host"}'
pnpm exec convex run --identity "$ID" sessions:create \
  '{"gameType":"hitster","joinMode":"room","authPolicy":"guestAllowed","title":"Test","displayName":"DJ CLI"}'
# then hitster:setup / hitster:start / hitster:reveal / hitster:nextRound with the
# returned sessionId and host participantId; backgammon:createState for a challenge.
```

## Checks

The root `pnpm run check`, `pnpm run typecheck` and `pnpm test` cover web, `@games/core`
and `@games/mobile`; CI runs the same commands.

# Arcade Club Mobile App: v1 Plan

Status: approved 2026-10-31. Decisions: v1 games = Sudoku, Backgammon, Hitster; solo
progress is stored locally without sync; identity "Arcade Club" / `com.appelent.arcadeclub`
/ scheme `arcadeclub`.

## Goal

Ship a native iOS/Android app for Arcade Club next to the existing web app. Web stays the
online/desktop surface; the app is the phone surface. Both talk to the same Convex
deployment and Clerk instance and share game rules through a workspace package.

## Inputs this plan follows

- `docs/mobile-app-design-guide.md` (this repo's draft guide).
- developer-tools standards: `mobile-baseline`, `mobile-coding`, `mobile-structure`,
  `mobile-design`, `ios-design`, `android-design`, `auth`, `i18n`, `environments`,
  `convex-query-caching`, `general-coding`, `verification`.
- Foundry (`~/Developer/workouts/apps/mobile`) as the primary reference implementation
  (it follows the newest structure standard: kebab-case, `src/features`, jest-expo,
  architecture check). Gather as secondary reference.

Where the draft guide and the toolkit standards disagree, the toolkit standards win and
the guide gets updated.

## Stack (matches Foundry)

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 58 (current `latest`), RN 0.88, React 19.3, Expo Router, typed routes, dev client (no Expo Go) |
| Identity | `app.config.ts` variants: `com.appelent.<id>` / `.preview` / `.dev` via `APP_VARIANT` |
| Auth | `@clerk/expo` v4, custom flows (password, email code, sign-up, verify, reset), `@clerk/expo/token-cache` |
| Backend | `convex` + `ConvexProviderWithClerk`; generated API re-exported from `src/convex/api.ts`; `convex-helpers` retention query cache, enforced with Biome `noRestrictedImports` |
| UI | `StyleSheet` + `useTokens()`/`useThemedStyles()`, `@expo/ui` controls, `NativeTabs`, `expo-symbols`, `expo-haptics` behind a semantic wrapper, Reanimated + Gesture Handler where boards need it |
| Prefs | `expo-sqlite/kv-store` (appearance, locale, guest identity, solo-game saves) |
| i18n | App-owned runtime copied from developer-tools `i18n/examples/{core,native}`; en + nl; message catalogs shared from `@arcadeclub/core` |
| Observability | `@sentry/react-native` wired, no-op without `EXPO_PUBLIC_SENTRY_DSN` |
| Tests | Jest + jest-expo + React Native Testing Library (mobile); Vitest (core, web, convex) |
| Quality | Biome (root config extended to `apps/mobile`), `tsc`, `scripts/check-mobile-architecture.mjs` from the structure standard |
| CI | `ci.yml` adds mobile typecheck + test + architecture check; opt-in label `build:ios`/`build:android` local EAS builds from the toolkit templates |

## Repository layout

```text
apps/mobile/            @arcadeclub/mobile (Expo)
  app/                  routes only
  src/features/<game>/  screens, boards, hooks per game
  src/ui/               generic primitives (never import features)
  src/{auth,convex,i18n,theme,prefs,feedback,observability,test-support}
packages/core/          @arcadeclub/core: pure game rules, catalog data, message catalogs
src/                    web app (unchanged location)
convex/                 shared backend
```

`packages/core` receives the pure files from `src/lib/games/*` (rules, generators, packs,
`sessions` helpers without `window`, catalog data without lucide icons) and the en/nl
message trees. Web, Convex and mobile import `@arcadeclub/core/<subpath>`. Web keeps its
adapters (localStorage, DOM, icons, scan image pipeline). Existing Vitest suites move
with the code.

## Navigation

```text
(tabs)
  play/        game list (Sudoku, Backgammon, Hitster), continue-playing row
  join/        enter room code; handles arcadeclub://join?token=…
  profile/     account, appearance, language, about / report a problem
(auth)/        sign-in, sign-in-code, sign-up, verify-email, reset/*  (modal stack)
<game>/…       per game: new/setup → lobby (online) → play → result
```

Guest play is the default; sign-in is required only where the backend already requires
it (hosting online rooms).

## Game scope (decided)

| Game | Mode on mobile | Porting effort |
| --- | --- | --- |
| Sudoku (classic, killer, binary) | Solo, local, offline | Easy (logic shared); scan deferred |
| Backgammon | Local pass-and-play + online challenge | Hard: native board with tap-to-move (drag later) |
| Hitster | Online room (host needs sign-in, guests join) | Medium: timeline placement UI |

Other games stay web-only in v1 and are not listed in the app. Online games reuse
existing Convex functions unchanged; mobile is just another client. Share links point
at the web `/join?token=` URL so web players can join too; the app handles the same
token through its scheme and a room-code entry. Universal links are deferred (need an
`apple-app-site-association` on the web domain).

## Persistence

Solo Sudoku and local backgammon are stored on the device (`expo-sqlite/kv-store`),
work offline and are not synced in v1. Online backgammon and Hitster are online-only via
Convex.

## Milestones

1. **Foundation**: adopt developer-tools (`sync-devtools`), pnpm workspace,
   `packages/core` extraction with web/convex imports updated and all web checks green,
   remove `task6-review/`.
2. **App shell**: scaffold Expo app, app config + EAS profiles, providers (appearance,
   locale, Clerk, Convex), tokens/theme from web palette, tabs, auth flows, guest
   identity, Sentry, jest setup, architecture check, CI.
3. **Sudoku**: all variants, notes, hints, undo, pause, completion, saved games list.
4. **Online shell**: create/join/lobby/share shared by room and challenge games.
5. **Backgammon**: local pass-and-play, then online challenge.
6. **Hitster**: lobby, setup, rounds, timeline placement, steals, reveal, results.
7. **Polish + verification**: haptics, empty/error/offline states, dark/light,
   small-phone layouts, iOS simulator + Android emulator walkthroughs via agent-device,
   docs (`apps/mobile/CODING_STANDARDS.md`, `DESIGN_SYSTEM.md`, runbook), update the
   draft design guide.

Each milestone ends with check, typecheck, tests and a device walkthrough.

## Out of scope for v1

Store submission, Sudoku scan (camera + OCR), the seven other games, push
notifications, universal links, cross-device sync of solo games.

## Existing issues found (not fixed by this plan)

- Game mutations (all except quiz, sessions, workbench) trust a caller-supplied
  `participantId`/`sessionId` without checking `ctx.auth` or guest identity. Anyone who
  learns a participant ID can act for that player. Affects web and mobile equally.
- `ci.yml` triggers on pushes to `master`, but the default branch is `main`.
- `task6-review/` test files are picked up by the root `tsconfig` include.
- `@tanstack/ai*` dependencies and `ANTHROPIC_API_KEY` are unused.
- Live quiz Convex duplicates `isCorrectAnswer`/`calculateAnswerScore` instead of
  importing the shared helpers.

## v1 outcome (2026-10-31)

Milestones 1–6 are delivered on `feat/mobile-app`. Milestone 7 delivered the polish
pass (Continue row for the local backgammon match, dark mode and large-text checks,
board text scaling) and the docs: `apps/mobile/CODING_STANDARDS.md`,
`apps/mobile/DESIGN_SYSTEM.md`, `docs/runbooks/mobile.md`.

Where this changed from the plan:

- Web and mobile share one en/nl catalog (`@arcadeclub/core/messages`). Server and
  rule errors carry a message key (`serverErrors.*`), not English text.
- Sentry reports errors from preview and production builds
  (`appelent/arcadeclub-mobile`); see the runbook.
- The structure check is `scripts/check-mobile-structure.mjs`, run from `pnpm run check`.
- CI needed no new jobs: the root `check`/`typecheck`/`test` already include mobile.
  Label-triggered EAS builds are not added. The EAS project `@appelent/arcadeclub` is linked.
- Device verification ran on the Android emulator and the iOS simulator: localized
  server errors (en and nl) and the largest text size on both; hosting a backgammon
  challenge and a Hitster room with the Clerk test account on Android.

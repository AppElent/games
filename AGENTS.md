# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

## Stack

TanStack Start (file-based routing, SSR, Vite) + Convex (real-time backend) + Clerk (auth, JWT-bridged to Convex) + Cloudflare Workers (deploy). Tailwind v4, Biome (not ESLint/Prettier), Vitest. Package manager is **pnpm** — never npm or yarn.

- Wrangler app name: `games` (prod), `games-dev` (dev environment).
- Environment variables: `env.manifest.ts` routes every value from Infisical (`/` then `/arcade-club`) to `.env*` files, EAS, Convex and GitHub — see `docs/runbooks/environment.md`. Don't hand-set EAS or GitHub values.
- Sentry: one project `appelent/arcadeclub` for mobile, browser, Worker (`src/server.ts`) and Convex, split by the `app` tag — see `docs/runbooks/sentry.md`.
- Auth UI is app-owned in `src/lib/auth` (copied from the shared auth standard, `docs/standards/auth.md`): Clerk-backed sign-in/sign-up/account UI, theme sync, and the dev-only test-login button. Reuse its exports instead of Clerk's prebuilt UI components. i18n runtime is app-owned too, in `src/lib/i18n`.

## Commands

```bash
pnpm run dev:watch        # Convex (watching) + Vite together — use this while editing convex/
pnpm run dev:all          # Convex pushed once, then Vite — functions won't re-sync on edit
pnpm run generate-routes  # tsr generate — run after adding/removing files under src/routes/
pnpm run typecheck        # tsc --noEmit
pnpm test                 # vitest run
pnpm run test:watch       # vitest
pnpm exec vitest run <path>   # run a single test file
pnpm run check             # biome check (lint + format check)
pnpm run lint:fix          # biome check --write
# pre-commit (lefthook, installed by pnpm install) runs biome check --staged;
# bypass with git commit --no-verify or LEFTHOOK=0
pnpm run build
pnpm run deploy:dev        # convex dev --once, build the games-dev Worker (CLOUDFLARE_ENV=dev), wrangler deploy
pnpm run deploy:prod       # production from this machine, values from Infisical (= `pnpm run deploy`); CI does this on merge
```

`check`, `typecheck` and `test` also cover `packages/core` and `apps/mobile` (Jest).

`pnpm exec convex env list` / `--prod` to inspect deployment env vars. `CLERK_JWT_ISSUER_DOMAIN` is required on every Convex deployment (dev, prod, and as a `preview` type default via `convex env default set ... --type preview`) — without it Convex never validates the Clerk JWT and `ctx.auth.getUserIdentity()` silently returns `undefined`.

## Architecture

### Game session model (`convex/schema.ts`, `convex/lib/gameSession.ts`)

All online games share one `gameSessions` + `sessionParticipants` pair of tables. Game ids, join modes (`room` code, `challenge` share link, `solo`) and auth policies are `as const` arrays in `packages/core/src/games.ts`, and Convex validators derive from them. Word Links and Squad Surge play locally with no session. Each game's Convex module (`convex/<game>.ts`) owns its state table, keyed by `sessionId`, and creates session, host and state in one `create` mutation through `convex/lib/hostedSession.ts`. `convex/lib/gameSession.ts` is the one owner of loading, starting, finishing and reopening a session; the two-seat games (backgammon, chess, connect four) share seats, turns and rematches through their `Duel` descriptor in `convex/lib/duel.ts`. Rules live in `packages/core` (`@arcadeclub/core`, pure, no dependencies), which throws `GameRuleError`; Convex wraps rule calls in `rules()` and throws keyed `gameError(code)`, and clients localize the code from `serverErrors`. Chess rules wrap `chess.js` in their own package, `packages/chess` (`@arcadeclub/chess`), so core stays dependency-free.

Joining goes through `sessions.joinByCode` (room code) or `sessions.joinByToken` (share link); both admit a `sessionParticipants` row via `convex/lib/join.ts`, whose `ON_JOIN` map holds each game's hook (seating a challenger, claiming a card seat), so `convex/sessions.ts` names no game. Participants are signed-in users (`userId`) or guests (`guestId`, generated client-side); read identity with `getOptionalUserId`/`requireUserId` from `convex/lib/auth.ts`.

The frontend mirrors this: `src/lib/games/catalog.ts` lists every game with its route and `sessionPath` (where a seated player plays, used by `/join`), with display text in `packages/core/src/i18n/*/catalog.ts` (`getLocalizedGame` joins the two). A tab's seat per session is `src/lib/games/seat.ts`; `NewGamePage`/`useHostSession` host a game, `SessionBundleRoute` renders a session route off the game's `getBundle`, and `useGameAction` runs mutations with localized errors. Every game runs fullscreen: game routes set `staticData: { fullscreen: true }` (typed in `src/lib/router-static-data.ts`), which `src/routes/__root.tsx` reads to hide the header and footer. Screens render inside `FullscreenGameShell` (viewport-filling, pause menu), `FullscreenGamePage` (scrolling lobbies and forms) or `FitScale` (fixed-size boards scaled to the viewport), all in `src/components/games/`. To add a game, use the `add-new-game` skill.

### Card games (`packages/core/src/cards`, `convex/cardGames.ts`, `src/components/cards`)

One catalog entry (`card-games`) leads to a hub at `/cards` listing Pesten and Jokeren. A game is a config file in `packages/core/src/cards/games/` for a rule family (`shedding`, `rummy`), so adding one to a family needs no backend or UI code. A table is created in one step by `cardGames.createTable`, and joiners claim a seat through `ON_JOIN` (`convex/lib/cardSeats.ts`). Before changing the engine, its stored state or seat claims, read [the decision](docs/adr/0001-card-games-use-rule-families-and-config.md).

### Mobile app (`apps/mobile`, `packages/core`)

pnpm workspace: `apps/mobile` is the Expo app **Arcade Club** (`com.appelent.arcadeclub`, scheme `arcadeclub`) with Sudoku (local), Backgammon (local pass-and-play + online challenge) and Hitster (online room). Other games are web-only and not listed in the app. Mobile is just another Convex client: it calls the same functions (hosting through `backgammon.create` and `hitster.create`) only via `apps/mobile/src/convex/api.ts`, stores its seats and local saves in `expo-sqlite/kv-store`, and shares web `/join?token=` links. Before native changes read `apps/mobile/CODING_STANDARDS.md` / `DESIGN_SYSTEM.md`; to run or verify it on a device, see `docs/runbooks/mobile.md`.

### Auth wiring

- `src/integrations/clerk/provider.tsx`: `ClerkProvider` wraps `AuthConfigProvider` (config in `src/lib/auth-config.ts` — app name, route paths for sign-in/sign-up/forgot-password/account, `afterAuth` redirect).
- `src/integrations/convex/provider.tsx`: **must** use `ConvexProviderWithClerk` (from `convex/react-clerk`) with Clerk's `useAuth`, not a bare `ConvexProvider` — otherwise the JWT never reaches Convex.
- `src/routes/{sign-in,sign-up,forgot-password,account}.tsx` are thin wrappers around `#/lib/auth`'s `AuthCard` + form components; `src/components/Header.tsx` uses its `HeaderUser`. Don't rebuild these with Clerk's own `<SignInButton>`/`<UserButton>`.
- Theme (light/dark/auto) is driven by `#/lib/auth`'s `getInitialMode`/`applyThemeMode`/`setThemeMode` + `ThemeSync` (reconciles with Clerk `unsafeMetadata` on sign-in) + the `THEME_INIT_SCRIPT` inline pre-paint script in `src/routes/__root.tsx`. Don't reintroduce a second local copy of this logic.

### Convex conventions

Validators and system fields: <https://docs.convex.dev/database/types>. Use `defineTable`/`.index(...)`, don't hand-add `_id`/`_creationTime`, and prefer `v.union(v.literal(...))` string enums (as used throughout `convex/schema.ts`) over free-form strings.

## Agent workflow layer

- `.claude/commands/upgrade-deps.md` (dependency upgrades; never weaken or skip tests to make one pass, stop and report instead), `.claude/commands/review-session.md` and `.claude/commands/babysit.md` (standing PR-babysitting policy) are plain-markdown procedures any agent can follow.
- `.claude/skills/verify` (route → module map), `add-new-game` and `generate-game-content` are project-specific skills.
- `.claude/hooks/session-start.mjs` — SessionStart hook: runs `pnpm install` once per fresh container, logs the current branch.
- `.github/workflows/ci.yml` — the quality gate (`check`, `typecheck`, `test`, `build`) on PRs; the `main` ruleset requires its `check` job and a PR for every change; `.github/workflows/deploy.yml` — a push to `main` (or "Run workflow") reruns CI, then deploys production Convex and the `games` Worker, using the `production` GitHub Environment written by `pnpm env:apply production`, then publishes the preview app's OTA update when an installed build can load it (`apps/mobile/scripts/ci-publish-update.mjs`, needs repo secret `EXPO_TOKEN`); `.github/workflows/preview.yml` — per-PR Convex + Cloudflare Worker preview, secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CONVEX_DEPLOY_KEY`, `SENTRY_AUTH_TOKEN` and variables `PREVIEW_CLERK_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, all written by `pnpm env:apply preview` except `CONVEX_DEPLOY_KEY`. PR previews start from an empty Convex backend, which needs no seed: the only reference data, the sample quiz, is created on demand by `quiz.ensureSampleSet`.
- Every workflow job sets up with `.github/actions/setup` (pnpm, the Node version, frozen install) after its checkout; bump Node there.
- `.github/workflows/mobile-runtime.yml` comments on each mobile PR whether it changes the runtime fingerprint; `mobile-build.yml` + `eas-local-build.yml` build the app on a runner (`eas build --local`) for PRs labelled `build:ios`/`build:android` or a manual run — see `docs/runbooks/mobile.md`.
- `appelent.json` holds the workspace policy that `node scripts/workspace.mjs` reads (see `docs/standards/workspaces.md`).

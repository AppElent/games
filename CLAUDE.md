# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

TanStack Start (file-based routing, SSR, Vite) + Convex (real-time backend) + Clerk (auth, JWT-bridged to Convex) + Cloudflare Workers (deploy). Tailwind v4, Biome (not ESLint/Prettier), Vitest. Package manager is **pnpm** — never npm or yarn.

- Wrangler app name: `games` (prod), `games-dev` (dev environment).
- Auth UI comes from the shared `@appelent/auth` package (private GitHub Packages registry) — custom Clerk-backed sign-in/sign-up/account UI, theme sync, and the dev-only test-login button. Don't hand-roll Clerk UI components; use this package's exports instead.

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
pnpm run build
pnpm run deploy:dev        # convex dev --once && build:development && wrangler deploy --env dev
pnpm run deploy:prod       # convex deploy && build && wrangler deploy (= `pnpm run deploy`)
```

`pnpm exec convex env list` / `--prod` to inspect deployment env vars. `CLERK_JWT_ISSUER_DOMAIN` is required on every Convex deployment (dev, prod, and as a `preview` type default via `convex env default set ... --type preview`) — without it Convex never validates the Clerk JWT and `ctx.auth.getUserIdentity()` silently returns `undefined`.

## Architecture

### Game session model (`convex/schema.ts`, `convex/sessions.ts`)

All games share one `gameSessions` + `sessionParticipants` pair of tables, not per-game session tables. A session has a `gameType` (`live-quiz` | `backgammon` | `sudoku` | `chess` | `hitster` | `word-games` — only the first two are implemented), a `joinMode` (`room` code, `challenge` share-link, or `solo`), and an `authPolicy` (`guestAllowed` | `signedInRequired` | `hostChoice`). Per-game state lives in its own table keyed by `sessionId` (`liveQuizStates`/`liveQuizAnswers`, `backgammonGameStates`/`backgammonMoves`) and is populated/mutated by that game's own Convex module (`convex/quiz.ts`, `convex/backgammon.ts`).

Joining happens through `sessions.joinByCode` (room code) or `sessions.joinByToken` (share token for challenge links); both create a `sessionParticipants` row and, for backgammon specifically, seat the joining participant into the waiting `backgammonGameStates` row. Participants can be signed-in users (`userId`) or guests (`guestId`, generated client-side) — `convex/lib/auth.ts`'s `getOptionalUserId`/`requireUserId` are the two entry points for reading identity in a Convex function.

The frontend mirrors this: `src/lib/games/catalog.ts` is the single source of truth for which games exist, their routes, and availability (`playable` vs `coming-soon`); `src/lib/games/sessions.ts` and `src/lib/games/<game>.ts` hold client-side helpers/types per game. `src/routes/games/$gameType.tsx` and per-game routes (`src/routes/quiz/*`, `src/routes/backgammon/*`) render off the catalog + session bundle (`sessions.getBundle`).

### Auth wiring

- `src/integrations/clerk/provider.tsx`: `ClerkProvider` wraps `AuthConfigProvider` (config in `src/lib/auth-config.ts` — app name, route paths for sign-in/sign-up/forgot-password/account, `afterAuth` redirect).
- `src/integrations/convex/provider.tsx`: **must** use `ConvexProviderWithClerk` (from `convex/react-clerk`) with Clerk's `useAuth`, not a bare `ConvexProvider` — otherwise the JWT never reaches Convex.
- `src/routes/{sign-in,sign-up,forgot-password,account}.tsx` are thin wrappers around `@appelent/auth`'s `AuthCard` + form components; `src/components/Header.tsx` uses the package's `HeaderUser`. Don't rebuild these with Clerk's own `<SignInButton>`/`<UserButton>` — that's the pattern this migration moved away from.
- Theme (light/dark/auto) is driven by `@appelent/auth`'s `getInitialMode`/`applyThemeMode`/`setThemeMode` + `ThemeSync` (reconciles with Clerk `unsafeMetadata` on sign-in) + the `THEME_INIT_SCRIPT` inline pre-paint script in `src/routes/__root.tsx`. Don't reintroduce a second local copy of this logic.

### Convex conventions

See `.cursorrules` for the full validator (`v`) reference and an example schema shape — the short version: use `defineTable`/`.index(...)`, don't hand-add `_id`/`_creationTime`, and prefer `v.union(v.literal(...))` string enums (as used throughout `convex/schema.ts`) over free-form strings.

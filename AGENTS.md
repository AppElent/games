# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Arcade Club is a party-games app: TanStack Start web (`src/`) on a Cloudflare Worker,
Convex backend (`convex/`), Expo phone app (`apps/mobile/`), shared rules in
`@arcadeclub/core` (`packages/core/`) and `@arcadeclub/chess` (`packages/chess/`).
Auth is Clerk. pnpm, always.

Before the task, read the matching project doc:

| When you are… | Read |
| --- | --- |
| Adding a game | the `add-new-game` skill |
| Changing how a game creates, joins, seats, starts, finishes or reopens a session, or a game route's fullscreen shell | [Game sessions](docs/contracts/game-sessions.md) |
| Changing card games, the card engine, its stored state or seat claims | [Card games](docs/contracts/card-games.md), then [its decision](docs/adr/0001-card-games-use-rule-families-and-config.md) |
| Drafting puzzles, word packs, quiz sets or prompts | the `generate-game-content` skill |
| Changing sign-in, account, theme sync, or how Clerk reaches Convex | [Auth](docs/contracts/auth.md) |
| Changing which games the phone app offers, or its seats and saves | [Mobile app](docs/contracts/mobile-app.md) |
| Building, running, verifying or releasing the phone app | [Mobile](docs/runbooks/mobile.md) |
| Running the dev server or checks, or verifying a web change | [Verification](docs/runbooks/verification.md), then the `verify` skill |
| Adding or changing an environment variable or secret | [Environment](docs/runbooks/environment.md) |
| Deploying, or changing the CI, deploy, preview or mobile build workflows | [Deploy](docs/runbooks/deploy.md) |
| Changing error reporting, source maps, or the `*_SENTRY_*` variables | [Sentry](docs/runbooks/sentry.md) |
| Upgrading dependencies | the `upgrade-dependencies` skill; never weaken or skip a test to make an upgrade pass — stop and report |
| Watching a pull request through CI and review | the `babysit-pr` skill |
| Reviewing the running app, or capturing a review session | the `review-app` skill |

Decisions: [ADR index](docs/README.md#decisions). Adding, moving, or finding docs:
[docs map](docs/README.md). Issues are GitHub Issues on `AppElent/games`.

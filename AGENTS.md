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
[docs map](docs/README.md). Issues live in Linear; see [Factory workflow](#factory-workflow).

## Factory workflow

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth. Work is a Linear issue with an app label and a blast radius.
Work lives in Linear, not GitHub Issues; do not open or track work as GitHub Issues.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <bot or fallback>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one). Do not merge the PR yourself.

After opening the PR, run a council review in this same thread as subagents (Opus, Sol, Grok; read-only). Post the scores and any blockers as a PR comment, fix blockers and re-run if needed, and end your final message with `Council verdict: PROCEED` (only if every reviewer scores 9 or higher with no blockers) or `Council verdict: REVISE` with reasons. Do not start separate review or council threads.

End your report with a **Leftover work** heading listing everything found but left out of scope, without fixing it.

Blast radius (`low` / `med` / `high`, also `blast-radius:low|med|high` on the PR):
- low: UI, copy, tests, refactors within one module, docs.
- med: data model changes with migration and rollback, new dependencies, CI/workflows, shared behaviour across several screens.
- high: auth, payments, production config, secrets, deleting data, permissions, anything affecting other users without a way back.

Agents never merge med or high PRs. Never read or change production secrets, and never approve production deployments.

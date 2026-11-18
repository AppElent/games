# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Arcade Club is a party-games app: TanStack Start web (`src/`) on a Cloudflare Worker,
Convex backend (`convex/`), Expo phone app (`apps/mobile/`), shared rules in
`@arcadeclub/core` (`packages/core/`) and `@arcadeclub/chess` (`packages/chess/`).
Auth is Clerk. pnpm, always.

Web and the phone app are equal ([ADR 0002](docs/adr/0002-ship-every-game-on-web-and-mobile.md)).
`packages/core/src/features.ts` says which feature and game is on which platform, and CI
fails when a route file is missing from it. A new game needs a `features.ts` entry and
ships on web and mobile together; a new route needs a feature.

Before the task, read the matching project doc:

| When you are… | Read |
| --- | --- |
| Adding a game | the `add-new-game` skill |
| Changing how a game creates, joins, seats, starts, finishes or reopens a session, or a game route's fullscreen shell | [Game sessions](docs/contracts/game-sessions.md) |
| Changing card games, the card engine, its stored state or seat claims | [Card games](docs/contracts/card-games.md), then [its decision](docs/adr/0001-card-games-use-rule-families-and-config.md) |
| Changing dice games, the dice engine, its rolls, or the table machinery cards and dice share | [Dice games](docs/contracts/dice-games.md), then [its decision](docs/adr/0003-dice-games-share-the-table-machinery.md) |
| Drafting puzzles, word packs, quiz sets or prompts | the `generate-game-content` skill |
| Changing sign-in, account, theme sync, or how Clerk reaches Convex | [Auth](docs/contracts/auth.md) |
| Changing which games the phone app offers, or its seats and saves | [Mobile app](docs/contracts/mobile-app.md), then [ADR 0002](docs/adr/0002-ship-every-game-on-web-and-mobile.md) |
| Building, running, verifying or releasing the phone app | [Mobile](docs/runbooks/mobile.md) |
| Running the dev server or checks, or verifying a web change | [Verification](docs/runbooks/verification.md), then the `verify` skill |
| Adding or changing an environment variable or secret | [Environment](docs/runbooks/environment.md) |
| Deploying, or changing the CI, deploy, preview or mobile build workflows | [Deploy](docs/runbooks/deploy.md) |
| Changing error reporting, source maps, or the `*_SENTRY_*` variables | [Sentry](docs/runbooks/sentry.md) |
| Upgrading dependencies | the `upgrade-dependencies` skill; never weaken or skip a test to make an upgrade pass — stop and report |
| Watching a pull request through CI and review | the `babysit-pr` skill |
| Reviewing the running app, or capturing a review session | the `review-app` skill |

Run `pnpm verify` (lint, typecheck and tests in one command) before pushing; see
[Verification](docs/runbooks/verification.md) for running a single step.

Decisions: [ADR index](docs/README.md#decisions). Adding, moving, or finding docs:
[docs map](docs/README.md). Issues live in Linear; see [Factory workflow](#factory-workflow).

## Factory workflow

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth. Work is a Linear issue with an app label and a blast radius.
Work lives in Linear, not GitHub Issues; do not open or track work as GitHub Issues.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <hub, grok, or claude-code>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one). Do not merge the PR yourself.

After opening the PR, review it by risk tier, in this same thread (state `Risk: low|med|high` with one line why in the PR body; when in doubt, pick the higher tier): **low** (copy, styling, small fixes, tests, docs) needs green CI and your own self-check against the acceptance criteria; **med** (new features, UI flows) needs one read-only code review by the other of Opus and Sol (Sol reviews Opus code, Opus reviews Sol or Codex code), answering `PROCEED` or `REVISE`, where `REVISE` needs a real blocker (bug, security or privacy, data loss, broken installed app, unmet acceptance criterion) and suggestions go to `## Leftover work`; **high** (Convex schema, auth, payments, data migrations, anything that can break installed mobile apps) needs `security-review` plus both Opus and Sol `PROCEED` and then waits for Eric. At most two review rounds; still `REVISE` after that goes to Eric. A council runs only when the issue has a `Council goal:` (see the developer-home RUNBOOK). The Codex GitHub review is advisory: address its comments, do not wait for it. Post the review as a PR comment, fix blockers, and end your final message with `Review verdict (<tier>): PROCEED` or `REVISE` with the open blockers. Do not start separate review or council threads.

UI changes: include screenshots in the PR (iOS simulator and web, light and dark, small screen); build with the app's design system tokens and components, no one-off styling; look up references (for example Mobbin) before a new screen; follow the Apple HIG and native controls on iOS. New screens or flows wait for Eric's approval of the screenshots before merge.

End your report with a **Leftover work** heading listing everything found but left out of scope, without fixing it.

Blast radius (`low` / `med` / `high`, also `blast-radius:low|med|high` on the PR):
- low: copy, styling, small fixes, tests, refactors within one module, docs.
- med: new features (for example a game), UI flows, new dependencies, shared behaviour across several screens.
- high: Convex schema, data migrations, deleting data, auth, permissions, payments, production config, secrets, CI or deploy config, and anything that can break the installed mobile apps or affect other users without a way back.

Coding agents never merge. The manager (the Claude Projects hub, the Grok fallback, or the Claude Code Chief of Staff thread) merges `low` and `med` after green CI, green QA, and the tier's review `PROCEED`; `high` and the changes the [factory runbook](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md) lists as waiting for Eric stay open for Eric. Never read or change production secrets, and never approve production deployments.

# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Arcade Club is a party-games app (web, Convex, Expo phone app, shared `packages/`). pnpm, always.

Web and the phone app are equal ([ADR 0002](docs/adr/0002-ship-every-game-on-web-and-mobile.md)):
a new game ships on both, and a new route needs a `packages/core/src/features.ts` entry or CI fails.

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

Run `pnpm verify` before pushing.

Decisions: [ADR index](docs/README.md#decisions). Adding, moving, or finding docs:
[docs map](docs/README.md).

## Factory workflow

The [factory runbook](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md) (on the Mac: `~/Developer/developer-home/RUNBOOK.md`) owns this process; where this section differs, the runbook wins.

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth; an issue has the app label and a blast radius. Track work there, never as GitHub Issues.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <hub, grok, or claude-code>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one).

Blast radius, which is also the review tier (`Risk: low|med|high` with one line why in the PR body, and `blast-radius:low|med|high` on the PR; when in doubt, pick the higher tier):
- low: copy, styling, small fixes, tests, refactors within one module, docs.
- med: new features (for example a game), UI flows, new dependencies, shared behaviour across several screens.
- high: Convex schema, data migrations, deleting data, auth, permissions, payments, production config, secrets, CI or deploy config, and anything that can break the installed mobile apps or affect other users without a way back.

Review the PR in this same thread as the runbook's [Review by risk tier](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md#review-by-risk-tier) says: `low` is green CI plus your self-check against the acceptance criteria; `med` and `high` get read-only reviewer subthreads, never separate review or council threads. The Codex GitHub review is advisory: address its comments, do not wait for it. Post the review on the PR, fix blockers, and end your final message with `Review verdict (<tier>): PROCEED` or `REVISE` with the open blockers, then a **Leftover work** heading listing everything found but left out of scope, without fixing it.

UI changes follow [general design](docs/standards/general-design.md): screenshots in the PR, and new screens or flows wait for Eric's approval before merge.

Coding agents never merge; the manager merges per the runbook. Never read or change production secrets, and never approve production deployments.

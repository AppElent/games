---
version: 4.2.0
description: Coding rules and task-specific implementation references.
---

# Coding standards

<!-- appelent-standards:start -->
## Shared guidance

Read only what the task needs; never preload every standard.

1. **Every code change:** [general coding](docs/standards/general-coding.md), plus [mobile coding](docs/standards/mobile-coding.md) for native code.
2. **When the task matches a row:** the linked standard.

| Task | Read |
| --- | --- |
| Adding, moving, or naming native files | [Mobile structure](docs/standards/mobile-structure.md) |
| Repository, package manager, formatter, types, tests, CI, or toolkit sync | [Baseline](docs/standards/baseline.md) |
| Top-level folders, workspace packages, or shared code between web, Convex, and mobile | [Repository layout](docs/standards/repo-layout.md) |
| Dependabot or automated dependency PRs | [Dependency updates](docs/standards/dependency-updates.md) |
| Web app stack, UI states, or browser capabilities | [Web baseline](docs/standards/web-baseline.md) |
| Expo setup or native configuration | [Mobile baseline](docs/standards/mobile-baseline.md) |
| Native builds, getting one onto a phone, TestFlight, OTA updates, or releases | [Mobile distribution](docs/standards/mobile-distribution.md) |
| Reporting work as done, verified, or accepted | [Verification](docs/standards/verification.md), then the project's check commands |
| Environment variables, secrets, `env.manifest.ts`, or `env:*` scripts | [Environments](docs/standards/environments.md) |
| Creating, preparing, or cleaning a worktree | [Workspaces](docs/standards/workspaces.md) |
| Authentication | [Auth](docs/standards/auth.md) |
| Convex functions, schema, migrations, seeds, tests, or account deletion and export | [Convex backend](docs/standards/convex.md) |
| Convex query reads, subscription retention, or local read caches | [Convex query caching](docs/standards/convex-query-caching.md) |
| Localization | [i18n](docs/standards/i18n.md) |
| Error reporting and source maps | [Sentry monitoring](docs/standards/sentry-monitoring.md) |
| In-app problem reports | [Issue reporting](docs/standards/issue-reporting.md) |
| Pull-request previews | [Previews](docs/standards/previews.md) |
| Staging or production deploys, deploy workflows, or branch rules | [Deployments](docs/standards/deployments.md) |
| Web manifest, installability, or service worker | [PWA](docs/standards/pwa.md) |
| Application CLI or browser login for it | [App CLI](docs/standards/app-cli.md) |
| MCP server or tools | [MCP](docs/standards/mcp.md) |
| Documentation or instruction changes | [Documentation](docs/standards/documentation.md) |
| Loading an external skill (Expo, Vercel React Native, better-*) | [Specialist skills](docs/standards/specialist-skills.md) |

### Working with standards

- **Conform:** follow standards as written. Rules are required unless marked **Default**. Installed copies are never edited in the project.
- **Improve:** when a standard is wrong, unclear, or missing a rule other projects would share, propose the change upstream with the `developer-tools` skill: a pull request when concrete, an issue when not.
- **Differ:** when this project needs something else, discuss it with the user first; never deviate silently. Record the agreed exception below: rule, scope, replacement, reason.

Project decisions below select implementations and explain deviations from shared defaults.
<!-- appelent-standards:end -->

## Workspaces

| Path | Owns |
| --- | --- |
| `src/`, `convex/` | TanStack Start web app and the shared Convex backend (root, to keep deployment wiring) |
| `apps/mobile/` | Expo app (Arcade Club); read [mobile standards](apps/mobile/CODING_STANDARDS.md) before native changes |
| `packages/core/` | `@arcadeclub/core`: pure game rules and pack data shared by web, Convex and mobile |
| `packages/chess/` | `@arcadeclub/chess`: chess rules on `chess.js`, for web and Convex; separate because core has no dependencies |

Run the root checks for every change: they cover all of these. Mobile run and device
verification facts live in the [mobile runbook](docs/runbooks/mobile.md).

## Project decisions

| Rule | Scope | Replacement | Reason |
| --- | --- | --- | --- |
| Auth web examples ([auth](docs/standards/auth.md)) | `src/lib/auth` | Clerk Core 3 (`@clerk/react`): the signal API with `finalize()`, `<Show when>`. Foundry's port is the reference. | The standard's `auth/examples/web` files still import deprecated `@clerk/clerk-react` 5 (only the i18n example has moved). Drop this row once they move to Core 3. |
| React version | Web and mobile | Web pins the exact React that the Expo SDK requires on mobile (19.3.0); bump both with the Expo SDK. | One React in the workspace. Dependabot already leaves `react`/`react-dom` to Expo upgrades. |
| Biome fragment ([baseline](docs/standards/baseline.md)) | `apps/mobile` | The query-hook import ban covers all of `apps/mobile`, tests included, except `query-cache.tsx`. | Stricter than the fragment, which leaves tests and files outside `src` and `app` unchecked. |
| CI template ([baseline](docs/standards/baseline.md)) | `.github/workflows/ci.yml` | Job `check`, triggered by `pull_request` and `workflow_call` instead of `push`; one `typecheck` and one `test` step, Node `22`. | The `main` ruleset requires `check`; `deploy.yml` reruns CI on main before shipping; root scripts already filter into core and mobile. |
| Cooldown exemption ([baseline](docs/standards/baseline.md)) | `pnpm-workspace.yaml` | `@appelent/*` is permanently exempt from `minimumReleaseAge`, without a date. | Our own registry packages. |
| CI update publish ([mobile distribution](docs/standards/mobile-distribution.md)) | `preview` channel | `deploy.yml` publishes after the production deploy. Production updates stay manual (`pnpm mobile:update:production`). | Preview is the daily driver and calls the production backend. |

### Deferred

- **Restart prompt acceptance ([mobile distribution](docs/standards/mobile-distribution.md#verify)):** covered by typecheck and a unit test of the resume-check policy. Seeing the prompt needs an installed preview build that downloads an update; check it after the next CI publish.
- **Staging tier ([deployments](docs/standards/deployments.md)):** not adopted. A merge to `main` deploys production, which the standard allows when there is no staging. Add staging when a release needs a gate before production.

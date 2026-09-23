# Appelent Mobile App Design Guide

Status: Draft reusable standard, proven first in Arcade Club Sudoku

## Purpose

This guide captures the default engineering choices for adding native iOS and
Android applications to an existing Appelent web project. It is intended to be
reused across projects and later promoted into the Appelent capability
registry, an `add-mobile-app` skill, and shared packages where repeated runtime
code justifies them.

This is a decision guide, not an instruction to make every project mobile. A
mobile app should have a clear user workflow that benefits from native
distribution, offline use, device APIs, or frequent phone interaction.

## Default Decision

Build one Expo React Native application for iOS and Android in the existing
repository. Keep the existing web app intact, share framework-independent
domain logic, build a native user interface, save locally first, and add
authenticated cloud synchronization only where it provides user value.

Use this default when:

- iOS and Android should ship from one TypeScript codebase.
- The product needs a genuinely native interaction model, not only an app-store
  icon around the website.
- Web and mobile should share business or game rules.
- Offline or interruption-tolerant operation matters.
- The existing backend and account system should remain authoritative.

Do not use it automatically when a responsive PWA already satisfies the user
need, native platform behavior is irrelevant, or the cost of store operations
is not justified.

## Architecture

Keep the current web application at the repository root and introduce pnpm
workspaces without relocating established code:

```text
apps/
  mobile/                 Expo React Native application
packages/
  <domain>-core/          Portable business or game logic
src/                      Existing web application
convex/                   Shared backend
pnpm-workspace.yaml
```

The mobile app owns:

- Expo Router routes and navigation.
- React Native screens and components.
- Device lifecycle handling.
- Local SQLite persistence.
- Secure mobile authentication tokens.
- Background synchronization orchestration.
- Haptics, accessibility, and platform-specific presentation.

Shared domain packages own:

- Types and validation rules.
- Deterministic state transitions.
- Calculations, solvers, generators, and conflict detection.
- Serialization contracts that are independent of storage technology.
- Fast unit tests.

Shared domain packages must not import React, React Native, DOM APIs, Expo,
Convex clients, Clerk, or storage APIs. Web and mobile own adapters around the
shared rules.

The backend owns:

- Authenticated identity and authorization.
- Canonical synchronized records.
- Server-side validation of client writes.
- Revision assignment and conflict detection.
- Cross-device queries and deletion tombstones.

## Why Expo

Expo is the Appelent default because it provides one supported React Native
toolchain for iOS and Android, SDK-compatible dependency installation, native
modules, routing, development builds, and EAS distribution.

Use the current supported Expo SDK selected by `create-expo-app`. Install Expo
modules with `expo install` through pnpm so their versions match that SDK.
Avoid pinning a reusable guide to arbitrary React Native package versions.

Start with Expo's automatic monorepo support. Do not add custom Metro aliases,
watch folders, or resolver paths unless an observed resolution problem requires
them. Use pnpm's isolated dependency layout first; switch to a hoisted linker
only for a confirmed incompatible package.

Choose bare React Native only when a required native integration cannot be
supported through Expo development builds, config plugins, or prebuild. Record
that exception in the project design before scaffolding.

## Native App, Not Web Wrapper

A WebView or thin Capacitor-style wrapper is useful for the fastest possible
store presence, but it is not the default for Appelent mobile products.

The default app uses native navigation, controls, gestures, lists, modals,
safe-area handling, accessibility semantics, haptics, and local persistence.
The web app remains a separate presentation layer over shared domain rules and
backend contracts.

Use a wrapper only when all of these are true:

- The website is already excellent at phone dimensions.
- Offline behavior and native device integration are unnecessary.
- Speed to distribution matters more than native interaction quality.
- The team accepts platform-review and WebView limitations.

## Repository and Package Management

Use pnpm for all workspace commands. Extend an existing
`pnpm-workspace.yaml`; do not overwrite its supply-chain settings,
allowlists, overrides, or comments.

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Use `workspace:*` for internal packages:

```json
{
  "dependencies": {
    "@appelent-example/domain-core": "workspace:*"
  }
}
```

Each workspace has its own TypeScript configuration and quality scripts. The
root web tsconfig should not accidentally compile React Native files with DOM
settings. Root verification should call the web, shared-package, and mobile
checks explicitly.

Before accepting the install, run `pnpm why react` and
`pnpm why react-native`. One mobile app must not bundle duplicate React or
native-module versions.

## Navigation and Product Shape

Build the usable product as the first screen, not a marketing landing page.
Use Expo Router with a small route tree based on real workflows.

A typical application has:

- A primary work or game screen.
- A history or saved-items screen when local continuity matters.
- An account screen for optional sign-in and synchronization status.
- Focused creation/setup routes.
- Detail routes addressed by stable local IDs.

Do not show nonfunctional catalog entries solely to imply future scope. Add
navigation destinations when they carry a usable workflow.

Prefer native conventions:

- Tabs for top-level destinations.
- Stacks for drill-in workflows.
- Modals for bounded tasks such as authentication or confirmation.
- Segmented controls for small mode choices.
- Switches and checkboxes for binary settings.
- Icon buttons for familiar commands.
- Text buttons for explicit actions.

Every control needs an accessibility label. Fixed-format surfaces such as game
boards, keypads, editors, and toolbars need stable dimensions so labels, hover
or press states, and dynamic values cannot shift the layout.

## Local-First Persistence

The device is the immediate source of truth while the user is working. Network
responses must not sit on the critical path for routine interaction.

Use Expo SQLite when the app stores structured, queryable, or revisioned data.
Use secure storage for credentials and small secrets, not for the application
database. Use a key-value store only for genuinely small preferences.

Every meaningful action follows this order:

```text
user action
  -> validate and calculate next state
  -> commit one local transaction
  -> update the interface
  -> mark an authenticated record pending
  -> attempt synchronization in the background
```

The local model normally includes:

- A device-generated stable ID.
- Domain state and schema/generator version.
- Status and lifecycle timestamps.
- Local revision.
- Optional owning account ID.
- Last known server revision.
- Sync state: local, pending, synced, or conflict.
- Optional completion and deletion timestamps.

Migrations are explicit, versioned, idempotent, and tested. Enable SQLite WAL
mode unless a documented platform constraint prevents it. Use bound SQL
parameters and transactions for multi-field updates.

Persist each meaningful action instead of relying on an operating-system
background callback. App backgrounding may request a final flush, but mobile
operating systems are allowed to terminate the process before it runs.

## Authentication

Do not require an account merely to open or evaluate an otherwise local
workflow. Let authentication unlock cloud backup, cross-device continuity,
shared data, or account-specific functionality.

For the current Appelent stack:

- Use Clerk's Expo SDK.
- Store session tokens with Clerk's supported secure token cache.
- Use `ConvexProviderWithClerk` so the Clerk JWT reaches Convex.
- Use Convex authentication state when deciding whether authenticated backend
  calls are ready.
- Derive ownership from `ctx.auth` in every Convex function.
- Never accept a caller-provided user ID as authorization.

Native Clerk components are acceptable when their beta/support status and
development-build requirement are explicitly accepted. Otherwise use a custom
JavaScript flow with Clerk's supported hooks. Keep authentication UI isolated
so changing this choice does not affect domain or synchronization code.

Signing out must not expose account-owned cached data to the next account on
the device. Purge fully synchronized private records. Keep unsynchronized
private records inaccessible and scoped to their original owner until that
same account returns and synchronization succeeds.

## Synchronization

Use an outbox model. Local writes mark records pending; one single-flight sync
worker pushes pending changes and then pulls canonical server changes.

Trigger synchronization after:

- Sign-in.
- A local authenticated write.
- Connectivity restoration.
- App foregrounding.
- Manual refresh.

Use bounded exponential backoff with jitter. Gameplay and primary workflows
must continue while offline, while a token refreshes, or while synchronization
is retrying.

### Revision Protocol

Each push includes the last server revision seen by that device:

```ts
type PushRequest<T> = {
  localId: string;
  baseRevision: number | null;
  payload: T;
};

type PushResult<T> =
  | { kind: "accepted"; revision: number; record: T }
  | { kind: "conflict"; revision: number; record: T };
```

The server accepts a matching revision, validates the complete payload,
increments the revision, and returns the canonical record. A mismatch returns
a conflict instead of overwriting silently.

Pull cursors must be stable when multiple records share a timestamp. Use a
directly indexed compound value, such as a fixed-width server timestamp plus a
stable record ID, rather than timestamp pagination alone.

### Conflict Rules

Prefer causality and revision lineage over device clocks. Mobile device clocks
are display metadata, not authoritative ordering.

Default conflict handling:

1. If only the cloud changed, apply the cloud record.
2. If only the client changed, accept the client update.
3. A causally newer deletion tombstone prevents an older device from restoring
   the record.
4. A completed state may win over an unfinished state when that rule is valid
   for the domain.
5. If two editable states diverged and cannot be merged safely, keep the cloud
   record canonical and preserve the local branch as a recovered copy with a
   new ID.

Domain-specific conflict policy belongs beside domain rules and tests. Do not
hide data loss behind a generic last-write-wins helper.

## Backend Integration

Reuse the project's existing Convex deployment and generic ownership/session
model where one exists. Add domain-specific state tables when structured
validation or querying matters; do not force all mobile state into an opaque
JSON blob.

Mobile-facing functions should be narrow:

- Push or create one owned record.
- Pull changes after a stable cursor.
- Complete a record with server validation.
- Write a deletion tombstone.

Validate payload shape, field ranges, legal status transitions, and domain
invariants on the server even when the same checks run locally. Return only
data the client needs. Do not synchronize hidden answers, private server
metadata, or secrets merely because they exist in the database row.

## Error Handling

Failures should preserve work and explain state without interrupting the main
workflow.

- Offline: keep working locally and show a restrained offline/sync indicator.
- Sync failure: retain pending data and retry.
- Authentication expiry: pause cloud work and allow local work to continue.
- Rejected payload: preserve the local record and mark it for attention.
- Corrupt local record: quarantine that record without blocking unrelated data.
- Generation/import failure: retry, then use a verified fallback where the
  domain supports one.
- Delete failure: retain the tombstone and retry.

Network or authentication failure alone must never delete user data.
Destructive user actions require confirmation.

## Testing Strategy

Use the test runner native to each layer:

- Shared TypeScript domain packages: Vitest.
- Expo components and hooks: Jest with `jest-expo` and React Native Testing
  Library.
- Expo Router navigation: `expo-router/testing-library`.
- Convex functions: Vitest with `convex-test`, plus a real deployment smoke
  check for behavior the mock cannot cover.
- End-to-end native workflows: Maestro or an equivalent accessibility-driven
  runner on development builds.

Required coverage:

- Pure domain rules and deterministic fixtures.
- Serialization and migration behavior.
- Every local command persisting before it resolves.
- Guest-to-account adoption and sign-out isolation.
- Push, pull, retry, cursor, tombstone, and conflict behavior.
- App termination/restart recovery.
- Primary navigation and workflows.
- Accessibility labels and touch targets.
- Light/dark appearance.
- Small and common phone dimensions without overlapping controls.
- Android and iOS development-build smoke tests.

Do not put tests inside the Expo Router app directory; every file there is
treated as a route.

## Configuration and Secrets

Document variable names in `.env.example`, never values. Expo client variables
are public at runtime and must use the `EXPO_PUBLIC_` prefix only for
non-secret configuration such as publishable keys and deployment URLs.

Typical variables:

```dotenv
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CONVEX_URL=
```

Keep Convex issuer configuration in Convex environment variables. Keep store,
EAS, Clerk, and signing credentials in their managed secret stores. Do not put
tokens or signing material in app config, Markdown, source code, or committed
`.npmrc` files.

## Build and Distribution

Use development builds when native modules or native authentication components
are present. Expo Go is a convenience, not the release runtime.

Standard EAS profiles:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "development-simulator": {
      "extends": "development",
      "ios": { "simulator": true }
    },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

Use preview builds for direct stakeholder installation. Use production builds
for TestFlight and Google Play internal testing. Public store submission is a
separate product/release milestone with its own metadata, privacy, policy,
support, and review work.

Windows can implement and test most shared, Android, and EAS workflows, but a
local iOS simulator requires macOS. Always include an EAS or macOS iOS
verification checkpoint before calling the mobile release complete.

## CI Quality Gate

The repository's existing web gate remains intact. Add explicit workspace
checks rather than replacing it:

```text
pnpm run check
pnpm run typecheck
pnpm test
pnpm test:core
pnpm typecheck:core
pnpm test:mobile
pnpm typecheck:mobile
pnpm run build
```

Add a non-store Expo export or development-build check where it provides useful
bundle verification. Native signed builds generally belong in EAS rather than
every pull request because of time, credentials, and cost.

## Adoption Checklist

### Product

- [ ] A mobile-specific user workflow is identified.
- [ ] Native app versus PWA/wrapper is an explicit decision.
- [ ] The first mobile slice is one complete workflow, not every web feature.
- [ ] Offline expectations and account requirements are defined.
- [ ] iOS and Android release ownership is understood.

### Architecture

- [ ] The app lives under `apps/mobile` in a pnpm workspace.
- [ ] Portable domain logic has no platform imports.
- [ ] Web behavior remains covered after extraction.
- [ ] Local IDs, revisions, statuses, and migrations are defined.
- [ ] Backend ownership is derived from authenticated identity.
- [ ] Conflict behavior is domain-specific and tested.

### Experience

- [ ] The first screen is a usable product workflow.
- [ ] Navigation follows native conventions.
- [ ] Every action has an accessibility label and adequate touch target.
- [ ] Fixed-format surfaces remain stable at supported phone sizes.
- [ ] Offline, syncing, error, empty, loading, and completion states exist.
- [ ] Light and dark appearance are verified.

### Delivery

- [ ] Shared, mobile, backend, and web checks run in CI.
- [ ] Android is tested on an emulator or device.
- [ ] iOS is tested through macOS or EAS.
- [ ] Development and preview builds are reproducible.
- [ ] TestFlight and Google Play internal-test paths are documented.
- [ ] Secrets and publishable client configuration are separated correctly.

## Appelent Framework Promotion Path

Do not extract a broad mobile runtime package from one implementation. Promote
this pattern in stages.

### Stage 1: Guide

Use this document while implementing the first two mobile applications. Record
which decisions remain stable and which vary by product.

### Stage 2: Skill-Owned Capability

Create an `add-mobile-app` skill that:

- Audits the current repo and package manager.
- Asks for the first native workflow and offline/auth requirements.
- Adds the pnpm workspace without clobbering baseline hardening.
- Scaffolds `apps/mobile` with the supported Expo SDK.
- Creates environment, test, EAS, and CI wiring.
- Creates a project-owned domain package boundary.
- Prints manual Clerk Native API, EAS, Apple, and Google setup steps.
- Registers and refreshes the Appelent project mirror.

An eventual illustrative capability entry is:

```json
{
  "mobile": {
    "owner": "skill",
    "skill": "add-mobile-app",
    "status": "active"
  }
}
```

Do not add this entry until the skill exists and passes its scaffold/audit
tests.

### Stage 3: Package Stable Runtime Code

After at least two projects expose the same runtime interfaces, consider:

- `@appelent/mobile-core` for platform-neutral lifecycle and status contracts.
- `@appelent/mobile-sync` for a generic revisioned outbox engine with injected
  repository, transport, and domain conflict policy.
- A mobile extension to `@appelent/auth`, or a separate mobile auth package, if
  the Clerk/Convex provider and account UI remain identical across apps.
- Test helpers for repository contracts, sync conflicts, and provider setup.

Keep application domain models, SQL schemas, screens, navigation, copy, and
conflict policy project-owned unless genuine repetition proves otherwise.

Each shared package README becomes the tool-agnostic source of truth. Skills
should point to package READMEs and handle orchestration; they should not
duplicate package integration documentation.

## Arcade Club Reference

The first proving implementation is Arcade Club's native Sudoku app:

- Expo app in `apps/mobile`.
- Shared Sudoku rules in `packages/sudoku-core`.
- Native Sudoku UI rather than reuse of React DOM components.
- SQLite-first gameplay.
- Optional Clerk sign-in.
- Revisioned Convex synchronization.
- Divergent games preserved as recovered copies.
- Camera scan/import deliberately deferred from the first native release.

Project-specific source documents:

- `docs/superpowers/specs/2026-07-11-native-mobile-sudoku-design.md`
- `docs/superpowers/plans/2026-07-12-native-mobile-sudoku.md`

## External References

- Expo monorepos: https://docs.expo.dev/guides/monorepos/
- Expo Router: https://docs.expo.dev/router/introduction/
- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo testing: https://docs.expo.dev/develop/unit-testing/
- Expo Router testing: https://docs.expo.dev/router/reference/testing/
- EAS build profiles: https://docs.expo.dev/build/eas-json/
- Clerk Expo: https://clerk.com/docs/expo/getting-started/quickstart
- Convex React Native: https://docs.convex.dev/client/react-native
- Convex with Clerk: https://docs.convex.dev/auth/clerk
- Convex testing: https://docs.convex.dev/testing/convex-test

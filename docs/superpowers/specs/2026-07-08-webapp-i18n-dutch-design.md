# Dutch i18n for Arcade Club + repeatable i18n pattern — Design

Date: 2026-07-08
Status: Approved

## Goal

Make the webapp available in Dutch alongside English, in a way that is repeatable
across other webapps in the same stack (TanStack Start + Convex + Clerk +
Cloudflare Workers). Two deliverables:

1. A repeatable i18n mechanism, added as a step to the personal
   `custom-bootstrap` skill so future apps get it the same way.
2. This app's UI strings and games-catalog text translated to Dutch.

Game content (word packs, puzzles, quiz sets) stays English in this phase — see
Follow-ups.

## Decisions made during brainstorming

- **Scope**: UI strings + catalog text now; native Dutch game content is a
  later, separate effort (wordplay does not survive translation — it must be
  authored, not translated).
- **Language selection**: auto-detect with a manual override. The switcher
  lives in the header next to `ThemeToggle` (guests have no profile page and
  need to switch without an account). Persistence mirrors the theme pattern:
  localStorage + cookie always, Clerk `unsafeMetadata` sync when signed in.
- **Mechanism**: homegrown typed dictionary (zero dependencies), chosen over
  react-i18next and Paraglide for simplicity, compile-time translation parity,
  and maximum bootstrap-skill repeatability. Two locales, developer-authored
  translations — a library earns its keep only with many locales or external
  translators.

## 1. Architecture — typed dictionary module (`src/lib/i18n/`)

Zero-dependency module:

- `messages/en/` is the source of truth, split by domain:
  - `common.ts` — shell (header/footer/home/dashboard/join), buttons, shared
    session/lobby vocabulary, error fallbacks.
  - `catalog.ts` — game titles, taglines, descriptions, primary actions, stats.
  - `games/<game>.ts` — per-game screens (lobbies, HUDs, pause menus, end
    screens).
  - `en/index.ts` merges them; `type Messages = typeof en`.
- `messages/nl/` mirrors the same files, each typed with `satisfies` against
  the English shape. **A missing or extra key is a compile error** —
  `pnpm run typecheck` enforces translation parity permanently.
- `index.ts` exports:
  - `LocaleProvider` (React context carrying locale + messages).
  - `useT()` / `useMessages()` hooks.
  - A small `{name}`-placeholder interpolation helper.
  - Plural handling via `Intl.PluralRules` (en and nl both have exactly two
    plural forms).
  - Dates and numbers via `Intl.DateTimeFormat` / `Intl.NumberFormat` with the
    active locale.

Supported locales: `"en" | "nl"`. Default: `en`.

## 2. Locale resolution & persistence

Resolution order:

1. `lang` cookie (explicit user choice)
2. Clerk `unsafeMetadata.language` (signed-in preference, reconciled like
   `ThemeSync`)
3. `Accept-Language` header (`nl*` → `nl`)
4. `en`

Because the choice lives in a cookie, TanStack Start SSR renders the correct
language on the server — no hydration flash and no pre-paint script (unlike
theme, which needs `THEME_INIT_SCRIPT`).

Switching language writes cookie + localStorage immediately and syncs to Clerk
`unsafeMetadata` when signed in. A compact EN/NL `LanguageToggle` component
sits in `src/components/Header.tsx` next to `ThemeToggle`.

## 3. String extraction scope

All hardcoded user-facing UI strings move to message keys:

- Shell: header, footer, home page, dashboard, join flow.
- `src/lib/games/catalog.ts`: structure unchanged; the human-text fields
  (`title`, `tagline`, `description`, `primaryAction`, `stats`) become lookups
  into `messages.catalog.<gameType>`.
- Every game's screens: lobbies, waiting rooms, HUDs, pause menus, end
  screens, setup forms.

This is a large but mechanical sweep across ~10 games. The implementation plan
batches it per game so each batch is independently verifiable.

### Deliberate exclusions (follow-ups, not this phase)

- **Convex server error strings.** `convex/*.ts` throws English `ConvexError`
  strings that `getUserErrorMessage` (src/lib/games/errors.ts) surfaces
  directly. Proper localization means migrating every `ConvexError` to an
  error *code* mapped to a message client-side — a separate sweep across all
  Convex modules. This phase keeps server error strings English; only the
  client-side fallback messages get localized.
- **Auth screens.** Sign-in/sign-up/account UI comes from `@appelent/auth`;
  its strings live in that package. Localizing it is a package-level follow-up
  (Clerk ships `nlNL` in `@clerk/localizations`, so it is feasible).

## 4. Game content stays English this phase

Content packs (Signal Words word pack, Word Links puzzles, quiz sets, Hitster
packs) remain English. The design leaves a clean seam for the follow-up: add a
`language: "en" | "nl"` field to pack/puzzle types and author native Dutch
packs. That work belongs with the `generate-game-content` skill and gets its
own spec.

## 5. Bootstrap skill update (the repeatable part)

`~/.claude/skills/custom-bootstrap/` gains:

- A new step, **"i18n (typed dictionary)"**, in SKILL.md — marked as
  on-request (not every app needs two languages), consistent with the skill's
  "merge, don't clobber" style.
- A reference file (`i18n.md`) containing the full scaffold: the
  `src/lib/i18n/` module template, cookie/SSR wiring for TanStack Start, the
  `LanguageToggle` component, and the Clerk `unsafeMetadata` sync.

## 6. Testing

- **Typecheck is the primary parity guarantee** — missing/extra keys fail
  `pnpm run typecheck`.
- One small Vitest suite adds:
  - Placeholder-token consistency: `{name}` tokens in each `nl` message match
    its `en` counterpart.
  - Locale-resolution logic: cookie parsing, `Accept-Language` parsing,
    fallback order.
- Game logic never imports messages, so existing game tests are untouched.

## Decomposition

One spec (this document), one implementation plan:
infra → shell → catalog → per-game batches → bootstrap skill update.

Named follow-ups, each a future spec:

1. Native Dutch game content (with `language` field on content types).
2. Convex error codes for localizable server errors.
3. `@appelent/auth` localization (Clerk `nlNL`).

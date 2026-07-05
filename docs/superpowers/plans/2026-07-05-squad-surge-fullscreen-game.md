# Squad Surge — army-growth gate-shooter (first fullscreen game)

> **Status:** ready to run. This plan was produced with the `add-new-game` skill and adapts it in two ways: (1) Squad Surge is a **local-only real-time solo game** (Word Links pattern — no Convex session/state module), and (2) it introduces the **fullscreen game layout** that every game will eventually adopt. Follow the phases in order.

## What we're building

A "Last War / Top War"-style lane runner. The player commands a squad that auto-runs forward down a track. Ahead are **gate pairs** with math operations (`×2`, `+15`, `−8`, …) side by side; the player steers left/right to pass through the better gate, growing or shrinking the army. Between gates, **enemy waves** clash with the squad and subtract soldiers. At the end a **boss number** must be beaten — army > boss = win, army hits 0 = loss.

- **Original name / no trade dress.** "Squad Surge" is an original title. Do not copy Last War/Top War art, names, UI, or icons.
- **Game id:** `squad-surge`  ·  **Join mode:** `solo`  ·  **Auth policy:** `guestAllowed`  ·  **Players:** 1
- **Persistence:** local-first (`localStorage`), exactly like Word Links. No Convex session is created. A Convex leaderboard is an optional stretch (Phase 7), not part of the definition of done.
- **Closest existing game to copy:** Word Links (`src/routes/word-links/*`, `src/lib/games/word-links*.ts`, `ssr: false`, local storage helpers).

## Why this game breaks new ground

Every existing game renders **inside** the Arcade chrome: `src/routes/__root.tsx` hardcodes `<Header />` and `<Footer />` around every route's `{children}`. Squad Surge must run **fullscreen** with only its own in-game menu (which offers "Return to Games hub"). We therefore build a small, reusable fullscreen layer first, adopt it here, and leave the other games untouched for a later migration.

---

## Phase 0 — Fullscreen layout infrastructure (do this first, it's the novel part)

This is reusable and independent of the game logic. Build and verify it before the game so the game just plugs in.

### 0.1 Route-level fullscreen flag

TanStack Router lets a route declare `staticData`. The root reads the matched routes and hides the Arcade chrome when any match opts into fullscreen.

Create `src/lib/router-static-data.ts` (module augmentation so `staticData.fullscreen` is typed):

```ts
import "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** When true, the Arcade Header/Footer are hidden and the route owns the whole viewport. */
    fullscreen?: boolean;
  }
}
```

Import it once from `src/routes/__root.tsx` (side-effect import) so the augmentation is in scope.

### 0.2 Root reads the flag

Edit `src/routes/__root.tsx` `RootDocument`:

```tsx
import { useRouterState } from "@tanstack/react-router";
import "#/lib/router-static-data";

function RootDocument({ children }: { children: React.ReactNode }) {
  const isFullscreen = useRouterState({
    select: (s) => s.matches.some((m) => m.staticData.fullscreen === true),
  });
  // ...existing providers...
  {!isFullscreen && <Header />}
  {children}
  {!isFullscreen && <Footer />}
}
```

Keep `<ThemeSync />` and the providers unconditionally. Only `<Header />` and `<Footer />` are gated.

### 0.3 iOS / mobile fullscreen viewport

In `src/routes/__root.tsx` `head().meta`, change the viewport line to opt into the safe-area:

```ts
{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
```

Add these meta tags for installed-PWA fullscreen (Safari only truly hides its chrome when the app is added to the Home Screen / runs standalone — call this out in the game's help text):

```ts
{ name: "apple-mobile-web-app-capable", content: "yes" },
{ name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
{ name: "mobile-web-app-capable", content: "yes" },
```

In `src/styles.css`, add a fullscreen utility layer:

```css
.game-fullscreen {
  position: fixed;
  inset: 0;
  height: 100svh; /* small viewport height — stable under mobile browser chrome */
  height: 100dvh; /* progressive enhancement where supported */
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
  overscroll-behavior: none;      /* kill pull-to-refresh / rubber-band */
  touch-action: none;             /* the play surface handles its own gestures */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  overflow: hidden;
}
```

### 0.4 Reusable fullscreen shell + return-to-hub menu

Create `src/components/games/FullscreenGameShell.tsx`. Responsibilities:

- Wrap children in `.game-fullscreen`.
- Render a small floating **menu button** (top-left inside the safe area, ≥44px touch target).
- Toggle an overlay panel (`club-panel` styling) with: **Resume**, **Restart** (calls an `onRestart` prop), **Return to Games** (`<Link to="/">`), and an optional **Sound** toggle.
- Expose props: `title`, `onRestart?`, `menuOpen`/`onMenuToggle` (or manage internally), and a `hud?` slot rendered at the top.
- Call an `onPauseChange(paused: boolean)` prop when the overlay opens/closes so the game loop can pause.

This component is what future games reuse when they migrate to fullscreen. Keep it game-agnostic.

### 0.5 Verify Phase 0 in isolation

Temporarily add `staticData: { fullscreen: true }` to any throwaway route (or the game start route once it exists), run the dev server (**port 3000 is OS-reserved on this machine — check `.claude/launch.json` for the real port**), and confirm: header/footer disappear, the shell fills the viewport, the menu overlay opens, "Return to Games" navigates to `/` and the chrome reappears. Test at 360px and with mobile-device emulation (safe-area insets).

---

## Phase 1 — Pure rules module (TDD)

Create `src/lib/games/squad-surge.ts`. Framework-free, deterministic, no Convex/React imports. Randomness is injected/seeded so tests are stable.

### Types

```ts
type GateOp = "mul" | "add" | "sub";
type Gate = { side: 0 | 1; op: GateOp; value: number };
type GatePair = { z: number; gates: [Gate, Gate] };
type Wave = { z: number; strength: number };
type Level = {
  seed: number;
  difficulty: number;
  length: number;         // total track distance
  gatePairs: GatePair[];  // sorted by z
  waves: Wave[];          // sorted by z
  boss: number;           // army needed to win at z === length
  startArmy: number;
};
type SimStatus = "running" | "won" | "lost";
type SimState = {
  z: number;        // distance travelled
  lane: number;     // continuous horizontal position, 0..1 (0 = left gate/side)
  army: number;     // integer soldier count, always >= 0
  nextGateIdx: number;
  nextWaveIdx: number;
  status: SimStatus;
  elapsed: number;
};
```

### Exports

- `mulberry32(seed: number): () => number` — small seeded PRNG (or reuse one if the repo already has it; grep first).
- `generateLevel(seed: number, difficulty: number): Level` — deterministic. Higher difficulty → more gate pairs/waves, bigger boss, tougher gate mixes. Gate `value`s and `op`s chosen from difficulty-scaled tables. Boss scaled to the *expected* army if the player plays near-optimally, minus a margin.
- `applyGate(army: number, gate: Gate): number` — `mul`: `floor(army*value)`; `add`: `army+value`; `sub`: `army-value`. Always `Math.max(0, …)`.
- `resolveWave(army: number, strength: number): number` — `Math.max(0, army - strength)`.
- `stepSimulation(state, input: { targetLane: number }, dt: number, level: Level): SimState` — pure, returns a NEW state:
  - If `status !== "running"`, return state unchanged (terminal is sticky).
  - Advance `z += SPEED * dt`; ease `lane` toward `clamp(input.targetLane, 0, 1)` by a fixed responsiveness factor.
  - While `nextGateIdx` gate pair's `z` has been crossed: pick the gate whose `side` matches the rounded lane (`lane < 0.5 ? 0 : 1`), `army = applyGate(army, chosenGate)`, advance `nextGateIdx`.
  - While `nextWaveIdx` wave's `z` has been crossed: `army = resolveWave(army, wave.strength)`; if `army === 0` → `status = "lost"`; advance `nextWaveIdx`.
  - If `z >= level.length`: resolve boss — `army > level.boss ? "won" : "lost"`.
- `initialState(level: Level): SimState`.
- `isTerminal(state): boolean`.

### Tests — `src/lib/games/__tests__/squad-surge.test.ts` (write first, target 16+)

1. `mulberry32` returns identical sequences for identical seeds.
2. `generateLevel` is deterministic for the same `(seed, difficulty)`.
3. Higher difficulty yields more waves and a larger boss.
4. `applyGate` `mul` multiplies and floors.
5. `applyGate` `add` adds.
6. `applyGate` `sub` subtracts.
7. `applyGate` never returns a negative army.
8. `stepSimulation` applies the **left** gate when `lane < 0.5` and the **right** gate when `lane ≥ 0.5` (two cases).
9. `resolveWave` reduces the army by strength.
10. `resolveWave` to exactly 0 sets `status: "lost"` via `stepSimulation`.
11. `stepSimulation` advances `z` by `SPEED * dt`.
12. Lane easing moves toward the target and stays clamped to `[0, 1]`.
13. Reaching the boss with `army > boss` sets `status: "won"`.
14. Reaching the boss with `army <= boss` sets `status: "lost"`.
15. A terminal state is sticky — stepping a `won`/`lost` state returns it unchanged.
16. A full scripted playthrough (fixed seed + scripted `targetLane` per frame) produces a deterministic, expected outcome.

Run: `pnpm exec vitest run src/lib/games/__tests__/squad-surge.test.ts`

---

## Phase 2 — Catalog entry

`src/lib/games/catalog.ts`:

1. Add `"squad-surge"` to the `GameType` union.
2. Add a `GAME_CATALOG_ITEMS` entry:
   - `title: "Squad Surge"`, `tagline: "Grow your army, break the line"`.
   - `description`: one sentence on steering through multiplier gates and beating the boss.
   - `joinMode: "solo"`, `authPolicy: "guestAllowed"`, `availability: "playable"`.
   - `accent`: a fresh gradient not already used (e.g. `"from-red-400 to-amber-300"` — confirm it's distinct).
   - `icon`: a lucide icon not already in use (e.g. `Swords` or `Rocket` — import it; `Users`/`Dices`/etc. are taken).
   - `primaryAction: "Deploy squad"`, `route: "/squad-surge"`, `stats: "Solo"`.

---

## Phase 3 — Convex sync (minimal — no session module)

Squad Surge is local-only, but `GameType` and `gameTypeValidator` must stay in sync (skill gotcha; Word Links is in both despite being local-only).

- `convex/schema.ts`: add `v.literal("squad-surge")` to `gameTypeValidator`.
- **No** `squadSurgeStates` table, **no** `convex/squadSurge.ts`, **no** `getBundle`. (Skip Step 3 of the skill exactly as Word Links does.)
- Run `pnpm exec convex dev --once` so codegen stays clean, then re-run typecheck.

---

## Phase 4 — Join wiring

**N/A.** Solo/local: no `joinByToken` seat block, no `join.tsx` redirect. Nothing to do here — noted for completeness against the skill checklist.

---

## Phase 5 — Routes + components (fullscreen)

Both routes are fullscreen and use `FullscreenGameShell`.

### 5.1 Local persistence

`src/lib/games/squad-surge-local.ts` (mirror `word-links-local.ts`): load/save best distance, highest level cleared, and settings (sound on/off). Guard `window`/`localStorage` for SSR safety even though routes are `ssr: false`.

### 5.2 Start / level-select route

`src/routes/squad-surge/index.tsx`:

```tsx
export const Route = createFileRoute("/squad-surge/")({
  component: SquadSurgeStart,
  staticData: { fullscreen: true },
  ssr: false,
});
```

Renders inside `FullscreenGameShell` (menu → Return to Games): title, best score from local storage, a difficulty/level picker, and a big **Start** button that navigates to `/squad-surge/play` (pass the chosen difficulty/seed via search params, e.g. `?d=1&seed=…`).

### 5.3 Gameplay route

`src/routes/squad-surge/play.tsx`:

```tsx
export const Route = createFileRoute("/squad-surge/play")({
  component: SquadSurgePlay,
  staticData: { fullscreen: true },
  ssr: false,
  validateSearch: (s) => ({ d: Number(s.d ?? 1), seed: Number(s.seed ?? Date.now()) }),
});
```

Renders `FullscreenGameShell` wrapping `SquadSurgeCanvas`. Wire `onRestart` to reset the sim with a new seed; wire `onPauseChange` to pause the loop when the menu overlay is open. On win/loss, show an end overlay with the result, best-score update, **Play again**, and **Return to Games**.

### 5.4 Game surface component

`src/components/squad-surge/SquadSurgeCanvas.tsx`:

- Holds a `<canvas>` sized to the container; render loop via `requestAnimationFrame`.
- Each frame: read input → build `{ targetLane }` → call `stepSimulation(state, input, dt, level)` (dt clamped, e.g. ≤ 1/30 to avoid tunneling on tab-switch) → draw.
- **Input:** pointer/touch X on the canvas maps to `targetLane` in `[0,1]`; keyboard `←/→` (or `A/D`) nudges the target lane for desktop. Use `pointer` events; set `touch-action: none` on the canvas.
- **Draw:** two lanes, the squad blob sized to `army`, upcoming gate pair with op labels, incoming wave markers, HUD (army count big, distance/progress bar, boss number near the end). Keep it readable at 360px; HUD text ≥ 14px, buttons ≥ 44px.
- Pause when `paused` (menu open) or when `document.hidden` (`visibilitychange`).
- Respect `prefers-reduced-motion` by toning down shake/particles.

`src/components/squad-surge/EndOverlay.tsx` (optional split): win/loss panel using `club-panel`.

Error handling: any thrown errors surfaced through `getUserErrorMessage(caught, "Squad Surge hit a snag")` from `#/lib/games/errors` — never raw errors. (Local game rarely throws, but keep the pattern.)

### 5.5 Regenerate routes

After adding route files: `pnpm run generate-routes`.

---

## Phase 6 — Verify (definition of done)

- [ ] `pnpm test` passes (16+ new pure-logic tests).
- [ ] `pnpm run check` passes (Biome).
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run build` passes.
- [ ] Catalog card "Squad Surge" is visible and routes to `/squad-surge`.
- [ ] **Fullscreen:** on `/squad-surge` and `/squad-surge/play` the Arcade Header/Footer are gone; every other route still shows them.
- [ ] The in-game menu opens, pauses the game, and **Return to Games** navigates to `/` with chrome restored.
- [ ] Game reaches both terminal states; end screen offers **Play again** and **Return to Games**.
- [ ] Army never goes negative; a wave that empties the army is a loss (covered by a test).
- [ ] Best score persists across reloads via `localStorage`.
- [ ] Guest play works (no sign-in required).
- [ ] Usable at 360px wide with no horizontal scroll; touch targets ≥44px.
- [ ] iOS check: safe-area insets respected (notch/home indicator not overlapped), no rubber-band scroll on the play surface, `100svh`/`100dvh` fills correctly. Note in help text that true chrome-free fullscreen needs "Add to Home Screen".
- [ ] Level generation is deterministic for a given seed (test) and family-friendly; no copied names/art/trade dress.

---

## Phase 7 — Optional stretch (not required for DoD)

- Convex leaderboard: add a `squadSurgeScores` table + `convex/squadSurge.ts` with a `submitScore` mutation (rate-limited, `guestAllowed`) and a `topScores` query; show it on the start screen. Only if a global leaderboard is wanted.
- Progressive levels / endless mode; power-ups; combo multipliers.

---

## Migration note (future, out of scope here)

Once `FullscreenGameShell` + the `staticData.fullscreen` flag are proven by Squad Surge, migrating the other games is: add `staticData: { fullscreen: true }` to each game's play route(s) and wrap their play screens in `FullscreenGameShell` (with a game-appropriate menu). The hub, dashboard, auth, and marketing routes keep the Arcade chrome. Do that as a separate, per-game task — not part of building Squad Surge.

## Gotchas checklist (from the skill)

- `GameType` (catalog) and `gameTypeValidator` (`convex/schema.ts`) must list identical ids — both get `squad-surge`.
- Pure module (`src/lib/games/squad-surge.ts`) must not import Convex or React; route/component code must not import the pure module's internals beyond its exports.
- Port 3000 is OS-reserved here — use the port in `.claude/launch.json` for the dev server.
- `ssr: false` on both routes (canvas + `localStorage` are client-only), matching Word Links.
- Don't reintroduce a second theme/header system; the fullscreen flag only hides the existing `Header`/`Footer`.

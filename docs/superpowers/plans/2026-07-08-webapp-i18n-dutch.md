# Dutch i18n (typed dictionary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the webapp's UI and games-catalog text available in Dutch via a zero-dependency typed-dictionary i18n module, and capture the pattern in the personal `custom-bootstrap` skill.

**Architecture:** A `src/lib/i18n/` module holds pure helpers (`core.ts`), message dictionaries (`messages/en/`, `messages/nl/` — Dutch typed against the English shape so missing keys fail typecheck), a React provider (`index.tsx`), and SSR locale resolution via a cookie + `Accept-Language` (`server.ts`). A header `LanguageToggle` switches locale; `LanguageSync` reconciles with Clerk `unsafeMetadata` like the existing theme sync. UI strings are then extracted game-by-game.

**Tech Stack:** TanStack Start 1.168 (`createServerFn`, `getCookie`/`getRequestHeader` from `@tanstack/react-start/server`), React 19, Clerk (`useUser`), Vitest, Biome (tabs, double quotes), pnpm.

**Spec:** `docs/superpowers/specs/2026-07-08-webapp-i18n-dutch-design.md`

---

## Execution context (read first)

- Work in the main repo `D:\Dev\games` on branch `claude/webapp-i18n-dutch-c13484` (already checked out). The `.claude/worktrees/cranky-jang-184818` folder is an empty stub — ignore it.
- **The repo contains unrelated uncommitted changes from other in-flight work.** Never `git add -A` or `git add .`. Stage only the exact files each task's commit step lists. Do not touch `convex/`, `src/routeTree.gen.ts`, or any file not named in a task.
- Commands: `pnpm run typecheck`, `pnpm exec vitest run <path>`, `pnpm test` (full suite), `pnpm run check` (biome). Biome style: **tab indentation, double quotes** — all code below follows it.
- The `#/` import alias maps to `src/` (used as `#/lib/...`, `#/components/...`).

## Shared string-extraction recipe (used by Tasks 8–16)

Every extraction task follows this exact procedure. The worked example is Task 6 (Header/Footer/home) — read it before doing any batch task.

1. **Find the strings.** For each file in the task's list, read it and identify every user-visible string literal: JSX text nodes, `aria-label`, `title`, `placeholder`, `alt`, button labels, toast/error fallback messages, and text drawn to canvas. Skip: `className`, route paths, keys/ids, `console.*`, code-only constants, and game *content* (word packs, puzzle terms, quiz questions — content stays English per the spec).
2. **Add English keys.** Create (or extend) `src/lib/i18n/messages/en/games/<game>.ts` exporting one object named after the game (camelCase, e.g. `bluffDice`). Group keys by component (`waitingRoom`, `hud`, `endScreen`, …); key names are camelCase and describe meaning, not position (`rollDice`, not `button1`). Dynamic values become `{placeholder}` tokens rendered with `fmt(...)`; counts use `plural(locale, n, { one, other })` with `{count}` in both forms.
3. **Register the game object** in `src/lib/i18n/messages/en/index.ts` under `games:` (and the Dutch twin in `nl/index.ts`).
4. **Author the Dutch file** `src/lib/i18n/messages/nl/games/<game>.ts` with the same shape (`satisfies` the English type — see Task 2 pattern). Follow the glossary and tone rules below. Translate meaning, not words; keep it short enough for the same UI space.
5. **Replace the literals.** In each component, add `const { messages, locale } = useI18n();` (or only what's needed) from `#/lib/i18n` and replace literals with `messages.games.<game>.<group>.<key>`, `fmt(...)` for placeholders. For non-React code paths (canvas render loops, pure helpers), pass the messages object or the needed strings in as a parameter — never import React context into game-logic files under `src/lib/games/`.
6. **Verify:** `pnpm run typecheck` (parity: a missing Dutch key fails here), `pnpm exec vitest run src/lib/i18n/__tests__/messages.test.ts` (placeholder parity), then `pnpm test` for the touched game's suite.
7. **Commit** only the files listed in the task.

### Dutch tone & glossary

Informal Dutch throughout (je/jij, never u). Buttons use imperatives or short infinitives ("Start", "Meedoen"). Consistent vocabulary:

| English | Dutch |
|---|---|
| room / room code | kamer / kamercode |
| join | meedoen |
| host (noun) | host |
| host a room (verb) | een kamer openen |
| share link / challenge link | deellink / uitdagingslink |
| guest | gast |
| player(s) | speler(s) |
| waiting room / lobby | wachtkamer / lobby |
| turn ("your turn") | beurt ("jij bent aan de beurt") |
| move | zet |
| game / match | spel / partij |
| board | bord |
| score / leaderboard | score / scorebord |
| spectator | toeschouwer |
| pause / resume / quit | pauze / verder spelen / stoppen |
| play again / rematch | opnieuw spelen / rematch |
| settings | instellingen |
| difficulty (easy/medium/hard) | moeilijkheid (makkelijk/gemiddeld/moeilijk) |
| sign in / sign out | inloggen / uitloggen |
| loading… | laden… |
| something went wrong | er ging iets mis |

Proper-noun game titles stay untranslated: Hitster, Word Links, Signal Words, Squad Surge, Backgammon, Sudoku. Translated titles: Chess → "Schaken", Connect Four → "Vier op een rij", Bluff Dice → "Blufdobbelen", Live Quiz → "Live quiz".

---

### Task 1: i18n core helpers (pure functions)

**Files:**
- Create: `src/lib/i18n/core.ts`
- Test: `src/lib/i18n/__tests__/core.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/i18n/__tests__/core.test.ts
import { describe, expect, it } from "vitest";
import { fmt, isLocale, plural, resolveLocale } from "../core";

describe("isLocale", () => {
	it("accepts supported locales", () => {
		expect(isLocale("en")).toBe(true);
		expect(isLocale("nl")).toBe(true);
	});

	it("rejects everything else", () => {
		expect(isLocale("de")).toBe(false);
		expect(isLocale("")).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});

describe("resolveLocale", () => {
	it("prefers a valid cookie over everything", () => {
		expect(resolveLocale("nl", "en-US")).toBe("nl");
		expect(resolveLocale("en", "nl-NL")).toBe("en");
	});

	it("ignores an invalid cookie", () => {
		expect(resolveLocale("de", "nl")).toBe("nl");
	});

	it("matches Accept-Language variants in order", () => {
		expect(resolveLocale(undefined, "nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
		expect(resolveLocale(undefined, "nl-BE")).toBe("nl");
		expect(resolveLocale(undefined, "fr-FR,en-GB;q=0.8")).toBe("en");
	});

	it("falls back to en", () => {
		expect(resolveLocale(undefined, undefined)).toBe("en");
		expect(resolveLocale(undefined, "de-DE,fr;q=0.9")).toBe("en");
	});
});

describe("fmt", () => {
	it("replaces placeholders", () => {
		expect(fmt("Hello {name}!", { name: "Eric" })).toBe("Hello Eric!");
		expect(fmt("{a} vs {b}", { a: 1, b: 2 })).toBe("1 vs 2");
	});

	it("leaves unknown placeholders intact", () => {
		expect(fmt("Hi {name}", {})).toBe("Hi {name}");
	});

	it("replaces repeated placeholders", () => {
		expect(fmt("{x} and {x}", { x: "y" })).toBe("y and y");
	});
});

describe("plural", () => {
	it("selects the singular form at 1", () => {
		expect(
			plural("en", 1, { one: "{count} player", other: "{count} players" }),
		).toBe("1 player");
		expect(
			plural("nl", 1, { one: "{count} speler", other: "{count} spelers" }),
		).toBe("1 speler");
	});

	it("selects the plural form otherwise", () => {
		expect(
			plural("en", 0, { one: "{count} player", other: "{count} players" }),
		).toBe("0 players");
		expect(
			plural("nl", 4, { one: "{count} speler", other: "{count} spelers" }),
		).toBe("4 spelers");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/i18n/__tests__/core.test.ts`
Expected: FAIL — cannot resolve `../core`.

- [ ] **Step 3: Implement core.ts**

```ts
// src/lib/i18n/core.ts
export const SUPPORTED_LOCALES = ["en", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Cookie that stores an explicit user language choice. */
export const LANG_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
	return SUPPORTED_LOCALES.includes(value as Locale);
}

/**
 * Resolve the active locale: explicit cookie choice first, then the first
 * Accept-Language entry matching a supported locale, then English.
 */
export function resolveLocale(
	cookieValue: string | undefined,
	acceptLanguage: string | undefined,
): Locale {
	if (isLocale(cookieValue)) {
		return cookieValue;
	}
	if (acceptLanguage) {
		for (const part of acceptLanguage.split(",")) {
			const tag = part.split(";")[0]?.trim().toLowerCase();
			if (!tag) {
				continue;
			}
			for (const locale of SUPPORTED_LOCALES) {
				if (tag === locale || tag.startsWith(`${locale}-`)) {
					return locale;
				}
			}
		}
	}
	return "en";
}

/** Interpolate {name} placeholders. Unknown placeholders are left as-is. */
export function fmt(
	template: string,
	params: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in params ? String(params[key]) : match,
	);
}

/** Pick a plural form (en and nl both only have one/other) and fill {count}. */
export function plural(
	locale: Locale,
	count: number,
	forms: { one: string; other: string },
): string {
	const category = new Intl.PluralRules(locale).select(count);
	const template = category === "one" ? forms.one : forms.other;
	return fmt(template, { count });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/i18n/__tests__/core.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/core.ts src/lib/i18n/__tests__/core.test.ts
git commit -m "feat(i18n): add locale resolution, interpolation, and plural helpers"
```

---

### Task 2: Message dictionaries (en/nl common) + parity test

**Files:**
- Create: `src/lib/i18n/messages/en/common.ts`, `src/lib/i18n/messages/en/index.ts`
- Create: `src/lib/i18n/messages/nl/common.ts`, `src/lib/i18n/messages/nl/index.ts`
- Test: `src/lib/i18n/__tests__/messages.test.ts`

- [ ] **Step 1: Write the English common messages**

These cover the shell (Header/Footer/home) extracted in Task 6, plus shared action/error vocabulary that later tasks reuse instead of re-adding per game.

```ts
// src/lib/i18n/messages/en/common.ts
export const common = {
	header: {
		games: "Games",
		join: "Join",
		dashboard: "Dashboard",
		switchLanguage: "Switch language to {language}",
	},
	footer: {
		copyright: "© {year} Arcade Club.",
		about: "About",
		tagline: "Live rooms, challenge links, and future game nights.",
	},
	home: {
		kicker: "Arcade Club",
		title: "Start a room, share a link, play together.",
		intro:
			"Live quiz nights, direct board-game challenges, and a growing shelf of party games for the next call, classroom, or couch session.",
	},
	actions: {
		start: "Start",
		cancel: "Cancel",
		close: "Close",
		save: "Save",
		delete: "Delete",
		copy: "Copy",
		copied: "Copied!",
		retry: "Try again",
		back: "Back",
		playAgain: "Play again",
		leave: "Leave",
	},
	session: {
		roomCode: "Room code",
		shareLink: "Share link",
		waitingForPlayers: "Waiting for players…",
		players: { one: "{count} player", other: "{count} players" },
		guest: "Guest",
		host: "Host",
		yourTurn: "Your turn",
		spectating: "Spectating",
	},
	errors: {
		somethingWentWrong: "Something went wrong. Please try again.",
		notFound: "Not found.",
		loading: "Loading…",
	},
};
```

- [ ] **Step 2: Write the English index (defines the `Messages` type)**

```ts
// src/lib/i18n/messages/en/index.ts
import { common } from "./common";

export const en = {
	common,
	games: {},
};

export type Messages = typeof en;
```

- [ ] **Step 3: Write the Dutch twin**

```ts
// src/lib/i18n/messages/nl/common.ts
import type { common as enCommon } from "../en/common";

export const common = {
	header: {
		games: "Spellen",
		join: "Meedoen",
		dashboard: "Dashboard",
		switchLanguage: "Taal wijzigen naar {language}",
	},
	footer: {
		copyright: "© {year} Arcade Club.",
		about: "Over",
		tagline: "Live kamers, uitdagingslinks en toekomstige spelavonden.",
	},
	home: {
		kicker: "Arcade Club",
		title: "Start een kamer, deel een link, speel samen.",
		intro:
			"Live quizavonden, directe bordspeluitdagingen en een groeiende plank partyspellen voor je volgende call, klas of banksessie.",
	},
	actions: {
		start: "Start",
		cancel: "Annuleren",
		close: "Sluiten",
		save: "Opslaan",
		delete: "Verwijderen",
		copy: "Kopiëren",
		copied: "Gekopieerd!",
		retry: "Opnieuw proberen",
		back: "Terug",
		playAgain: "Opnieuw spelen",
		leave: "Verlaten",
	},
	session: {
		roomCode: "Kamercode",
		shareLink: "Deellink",
		waitingForPlayers: "Wachten op spelers…",
		players: { one: "{count} speler", other: "{count} spelers" },
		guest: "Gast",
		host: "Host",
		yourTurn: "Jij bent aan de beurt",
		spectating: "Meekijken",
	},
	errors: {
		somethingWentWrong: "Er ging iets mis. Probeer het opnieuw.",
		notFound: "Niet gevonden.",
		loading: "Laden…",
	},
} satisfies typeof enCommon;
```

```ts
// src/lib/i18n/messages/nl/index.ts
import type { Messages } from "../en";
import { common } from "./common";

export const nl = {
	common,
	games: {},
} satisfies Messages;
```

- [ ] **Step 4: Write the parity test**

Beyond the compile-time `satisfies` check, this verifies at runtime that both trees have identical keys, non-empty string leaves, and identical `{placeholder}` token sets per leaf — the thing `satisfies` can't check.

```ts
// src/lib/i18n/__tests__/messages.test.ts
import { describe, expect, it } from "vitest";
import { en } from "../messages/en";
import { nl } from "../messages/nl";

type Tree = { [key: string]: string | Tree };

function collectLeaves(tree: Tree, prefix: string, out: Map<string, string>) {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			out.set(path, value);
		} else {
			collectLeaves(value, path, out);
		}
	}
}

function placeholders(message: string): string[] {
	return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("message dictionaries", () => {
	const enLeaves = new Map<string, string>();
	const nlLeaves = new Map<string, string>();
	collectLeaves(en as unknown as Tree, "", enLeaves);
	collectLeaves(nl as unknown as Tree, "", nlLeaves);

	it("have identical key sets", () => {
		expect([...nlLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
	});

	it("have no empty messages", () => {
		for (const [path, value] of [...enLeaves, ...nlLeaves]) {
			expect(value.trim(), path).not.toBe("");
		}
	});

	it("use the same placeholders per message", () => {
		for (const [path, enValue] of enLeaves) {
			const nlValue = nlLeaves.get(path);
			expect(nlValue, path).toBeDefined();
			expect(placeholders(nlValue as string), path).toEqual(
				placeholders(enValue),
			);
		}
	});
});
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm exec vitest run src/lib/i18n/__tests__/messages.test.ts`
Expected: PASS.
Run: `pnpm run typecheck`
Expected: no errors. (Sanity check the guarantee: temporarily delete a key from `nl/common.ts`, confirm typecheck fails, restore it.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/messages src/lib/i18n/__tests__/messages.test.ts
git commit -m "feat(i18n): add en/nl common message dictionaries with parity test"
```

---

### Task 3: React provider and hooks

**Files:**
- Create: `src/lib/i18n/index.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
// src/lib/i18n/index.tsx
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { isLocale, LANG_COOKIE, type Locale, resolveLocale } from "./core";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";

export { fmt, isLocale, LANG_COOKIE, plural, resolveLocale } from "./core";
export type { Locale } from "./core";
export type { Messages };

const MESSAGES: Record<Locale, Messages> = { en, nl };

type I18nValue = {
	locale: Locale;
	messages: Messages;
	setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

function readLangCookie(): string | undefined {
	const row = document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(`${LANG_COOKIE}=`));
	return row?.slice(LANG_COOKIE.length + 1);
}

/** Client-side locale resolution (mirrors the server's cookie-first order). */
export function readClientLocale(): Locale {
	return resolveLocale(readLangCookie(), navigator.language);
}

/** True when the user made an explicit choice (cookie set by setLocale). */
export function hasExplicitLocaleChoice(): boolean {
	return isLocale(readLangCookie());
}

export function LocaleProvider({
	initialLocale,
	children,
}: {
	initialLocale: Locale;
	children: React.ReactNode;
}) {
	const [locale, setLocaleState] = useState<Locale>(initialLocale);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
		document.documentElement.lang = next;
	}, []);

	const value = useMemo<I18nValue>(
		() => ({ locale, messages: MESSAGES[locale], setLocale }),
		[locale, setLocale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const value = useContext(I18nContext);
	if (!value) {
		throw new Error("useI18n must be used inside LocaleProvider");
	}
	return value;
}

export function useMessages(): Messages {
	return useI18n().messages;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/index.tsx
git commit -m "feat(i18n): add LocaleProvider and useI18n hooks"
```

---

### Task 4: SSR locale resolution + root wiring

**Files:**
- Create: `src/lib/i18n/server.ts`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Implement the server function**

```ts
// src/lib/i18n/server.ts
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { LANG_COOKIE, type Locale, resolveLocale } from "./core";

export const getSsrLocale = createServerFn({ method: "GET" }).handler(
	(): { locale: Locale } => ({
		locale: resolveLocale(
			getCookie(LANG_COOKIE),
			getRequestHeader("accept-language"),
		),
	}),
);
```

- [ ] **Step 2: Wire the root route**

In `src/routes/__root.tsx`:

Add imports:

```tsx
import { LocaleProvider, readClientLocale } from "#/lib/i18n";
import { getSsrLocale } from "#/lib/i18n/server";
```

Add a `loader` to the route options (after `head`, before `shellComponent`). The `typeof document` guard keeps client-side navigations from making an HTTP round-trip — the cookie is readable locally there:

```tsx
	loader: () => {
		if (typeof document !== "undefined") {
			return { locale: readClientLocale() };
		}
		return getSsrLocale();
	},
```

Change `RootDocument` to read the locale, set `<html lang>`, and mount the provider (outermost, so everything including Clerk-adjacent UI can use it):

```tsx
function RootDocument({ children }: { children: React.ReactNode }) {
	const { locale } = Route.useLoaderData();
	const isFullscreen = useRouterState({
		select: (s) => s.matches.some((m) => m.staticData.fullscreen === true),
	});
	return (
		<html lang={locale} suppressHydrationWarning>
```

(`lang` stays correct after a client-side switch because `setLocale` writes `document.documentElement.lang`.)

Wrap the body contents:

```tsx
			<body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-cyan-300/30">
				<LocaleProvider initialLocale={locale}>
					<ClerkProvider>
						<ConvexProvider>
							{/* ...existing children unchanged... */}
						</ConvexProvider>
					</ClerkProvider>
				</LocaleProvider>
				<Scripts />
			</body>
```

- [ ] **Step 3: Verify SSR picks the right language**

Run: `pnpm run typecheck` — expected: no errors.
Start the dev server (`pnpm run dev:all`; per memory note, port 3000 can be OS-reserved on this machine — use the port Vite actually reports). Then:

```bash
curl -s -H "Accept-Language: nl-NL,nl;q=0.9" http://localhost:<port>/ | grep -o '<html lang="[a-z]*"'
```

Expected: `<html lang="nl"`. And with `-H "Accept-Language: de-DE"`: `<html lang="en"`. And with `-H "Cookie: lang=nl" -H "Accept-Language: de-DE"`: `<html lang="nl"`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/server.ts src/routes/__root.tsx
git commit -m "feat(i18n): resolve locale on SSR via cookie and Accept-Language"
```

---

### Task 5: LanguageToggle + Clerk LanguageSync

**Files:**
- Create: `src/components/LanguageToggle.tsx`
- Create: `src/lib/i18n/LanguageSync.tsx`
- Modify: `src/components/Header.tsx` (mount toggle)
- Modify: `src/routes/__root.tsx` (mount sync)

- [ ] **Step 1: Implement the toggle**

Styling matches `ThemeToggle.tsx`'s button exactly (same classes).

```tsx
// src/components/LanguageToggle.tsx
import { fmt, useI18n } from "#/lib/i18n";

const LOCALE_NAMES = { en: "English", nl: "Nederlands" } as const;

export default function LanguageToggle() {
	const { locale, messages, setLocale } = useI18n();
	const next = locale === "en" ? "nl" : "en";
	const label = fmt(messages.common.header.switchLanguage, {
		language: LOCALE_NAMES[next],
	});

	return (
		<button
			type="button"
			onClick={() => setLocale(next)}
			aria-label={label}
			title={label}
			className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
		>
			{locale.toUpperCase()}
		</button>
	);
}
```

- [ ] **Step 2: Implement LanguageSync**

Mirrors the theme reconciliation: a saved Clerk preference applies when the device has no explicit choice; otherwise the explicit local choice is pushed to Clerk. The cookie written by `setLocale` breaks the loop (after applying, `savedLocale === locale`).

```tsx
// src/lib/i18n/LanguageSync.tsx
import { useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { hasExplicitLocaleChoice, isLocale, useI18n } from "./index";

export function LanguageSync() {
	const { user } = useUser();
	const { locale, setLocale } = useI18n();
	const userId = user?.id;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `user` identity changes on every update() — keying on userId/locale is deliberate to avoid a sync loop.
	useEffect(() => {
		if (!user) {
			return;
		}
		const saved = user.unsafeMetadata?.language;
		const savedLocale = isLocale(saved) ? saved : undefined;
		if (savedLocale === locale) {
			return;
		}
		if (savedLocale && !hasExplicitLocaleChoice()) {
			setLocale(savedLocale);
			return;
		}
		user
			.update({ unsafeMetadata: { ...user.unsafeMetadata, language: locale } })
			.catch(() => {
				// Best-effort sync; the cookie already holds the choice locally.
			});
	}, [userId, locale, setLocale]);

	return null;
}
```

- [ ] **Step 3: Mount both**

In `src/routes/__root.tsx`, next to `<ThemeSync />` (inside ClerkProvider + ConvexProvider):

```tsx
import { LanguageSync } from "#/lib/i18n/LanguageSync";
// ...
						<ThemeSync />
						<LanguageSync />
```

In `src/components/Header.tsx`, next to the theme toggle:

```tsx
import LanguageToggle from "./LanguageToggle";
// ...
				<div className="ml-auto flex items-center gap-2">
					<HeaderUser />
					<LanguageToggle />
					<ThemeToggle />
				</div>
```

- [ ] **Step 4: Verify in the browser**

`pnpm run typecheck`, then with the dev server running, open the app (Claude Preview or browser): the header shows an `EN` button; clicking it flips to `NL` and back; after choosing NL and reloading, `<html lang="nl">` persists (cookie). Signed in, check Clerk user `unsafeMetadata.language` updates (visible via the account page network calls or Clerk dashboard — best-effort check, don't block on it).

- [ ] **Step 5: Commit**

```bash
git add src/components/LanguageToggle.tsx src/lib/i18n/LanguageSync.tsx src/components/Header.tsx src/routes/__root.tsx
git commit -m "feat(i18n): add header language toggle with Clerk metadata sync"
```

---

### Task 6: Shell string extraction (worked example for all batches)

**Files:**
- Modify: `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/routes/index.tsx`, `src/routes/about.tsx`

- [ ] **Step 1: Header**

Replace the three nav literals (keys already exist from Task 2):

```tsx
import { useMessages } from "#/lib/i18n";
// ...
export default function Header() {
	const messages = useMessages();
	// ... "Games" → {messages.common.header.games}
	// ... "Join" → {messages.common.header.join}
	// ... "Dashboard" → {messages.common.header.dashboard}
```

"Arcade Club" (brand name) stays hardcoded — brand names are not translated.

- [ ] **Step 2: Footer**

```tsx
import { fmt, useMessages } from "#/lib/i18n";
import { Link } from "@tanstack/react-router";

export default function Footer() {
	const messages = useMessages();
	const year = new Date().getFullYear();

	return (
		<footer className="mt-16 border-t border-[var(--club-line)] px-4 py-8 text-sm text-[var(--club-muted)]">
			<div className="club-wrap flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<p className="m-0">{fmt(messages.common.footer.copyright, { year })}</p>
				<div className="flex items-center gap-4">
					<Link
						to="/about"
						className="text-[var(--club-muted)] no-underline hover:text-[var(--club-text)] hover:underline"
						activeProps={{ className: "text-[var(--club-text)] underline" }}
					>
						{messages.common.footer.about}
					</Link>
					<span className="m-0">{messages.common.footer.tagline}</span>
				</div>
			</div>
		</footer>
	);
}
```

- [ ] **Step 3: Home page**

In `src/routes/index.tsx`, replace the kicker/title/intro literals with `messages.common.home.kicker` / `.title` / `.intro` (add `const messages = useMessages();` in `HomePage`).

- [ ] **Step 4: About page**

Read `src/routes/about.tsx`, extract its user-visible strings into a new `about` group in `messages/en/common.ts` + Dutch in `nl/common.ts` (same nested-group pattern as `home`), and replace the literals.

- [ ] **Step 5: Verify**

Run: `pnpm run typecheck && pnpm exec vitest run src/lib/i18n/__tests__/messages.test.ts`
Expected: PASS. In the browser, toggle NL: header nav reads "Spellen / Meedoen / Dashboard", home title "Start een kamer, deel een link, speel samen."

- [ ] **Step 6: Commit**

```bash
git add src/components/Header.tsx src/components/Footer.tsx src/routes/index.tsx src/routes/about.tsx src/lib/i18n/messages/en/common.ts src/lib/i18n/messages/nl/common.ts
git commit -m "feat(i18n): localize shell (header, footer, home, about)"
```

---

### Task 7: Catalog localization

**Files:**
- Create: `src/lib/i18n/messages/en/catalog.ts`, `src/lib/i18n/messages/nl/catalog.ts`, `src/lib/i18n/catalog.ts`
- Modify: `src/lib/i18n/messages/en/index.ts`, `src/lib/i18n/messages/nl/index.ts`
- Modify: `src/components/games/GameCatalog.tsx`, `src/routes/games/$gameType.tsx`, `src/routes/dashboard/index.tsx`

- [ ] **Step 1: Derive English catalog text from the catalog (single source, no duplication)**

```ts
// src/lib/i18n/messages/en/catalog.ts
import { GAME_CATALOG, type GameType } from "#/lib/games/catalog";

export type CatalogText = {
	title: string;
	tagline: string;
	description: string;
	primaryAction: string;
	stats: string;
};

function textOf(type: GameType): CatalogText {
	const game = GAME_CATALOG.find((item) => item.type === type);
	if (!game) {
		throw new Error(`Unknown game type: ${type}`);
	}
	const { title, tagline, description, primaryAction, stats } = game;
	return { title, tagline, description, primaryAction, stats };
}

export const catalog = {
	"live-quiz": textOf("live-quiz"),
	backgammon: textOf("backgammon"),
	sudoku: textOf("sudoku"),
	chess: textOf("chess"),
	hitster: textOf("hitster"),
	"word-links": textOf("word-links"),
	"connect-four": textOf("connect-four"),
	"signal-words": textOf("signal-words"),
	"bluff-dice": textOf("bluff-dice"),
	"squad-surge": textOf("squad-surge"),
} satisfies Record<GameType, CatalogText>;
```

- [ ] **Step 2: Author the Dutch catalog**

```ts
// src/lib/i18n/messages/nl/catalog.ts
import type { GameType } from "#/lib/games/catalog";
import type { CatalogText } from "../en/catalog";

export const catalog = {
	"live-quiz": {
		title: "Live quiz",
		tagline: "Quizavonden met een host",
		description:
			"Open een kamer, toon vragen op het grote scherm en laat iedereen antwoorden op z'n eigen apparaat.",
		primaryAction: "Quiz hosten",
		stats: "Kamercode",
	},
	backgammon: {
		title: "Backgammon",
		tagline: "Uitdaging voor twee",
		description:
			"Start een bord, deel een link of QR-code en laat je tegenstander de tweede stoel innemen.",
		primaryAction: "Partij starten",
		stats: "Deellink",
	},
	sudoku: {
		title: "Sudoku",
		tagline: "Solo puzzelsessies",
		description:
			"Genereer puzzels in vier moeilijkheidsgraden, noteer met pro-notatie of scan een papieren puzzel en los 'm digitaal op.",
		primaryAction: "Sudoku spelen",
		stats: "Solo",
	},
	chess: {
		title: "Schaken",
		tagline: "Directe bordduels",
		description:
			"Deel een uitdagingslink en speel een strakke realtime partij.",
		primaryAction: "Partij starten",
		stats: "2 spelers",
	},
	hitster: {
		title: "Hitster",
		tagline: "Muziek-tijdlijnfeest",
		description:
			"Host een muziekronde en plaats nummers op een gedeelde tijdlijn met vrienden.",
		primaryAction: "Kamer openen",
		stats: "Kamercode",
	},
	"word-links": {
		title: "Word Links",
		tagline: "Dagelijkse groepeerpuzzel",
		description:
			"Sorteer 16 woorden in vier verborgen groepen. Elke dag een verse puzzel plus een stapel oefenpuzzels.",
		primaryAction: "Speel de dagpuzzel",
		stats: "Dagelijks",
	},
	"connect-four": {
		title: "Vier op een rij",
		tagline: "Laat vallen, stapel, verbind",
		description:
			"De klassieker: vier op een rij. Deel een uitdagingslink en laat schijven realtime vallen.",
		primaryAction: "Spel starten",
		stats: "2 spelers",
	},
	"signal-words": {
		title: "Signal Words",
		tagline: "Teamduels met hints",
		description:
			"Twee teams, één raster van 25 woorden. Hintgevers seinen, teams raden — en iedereen vermijdt de valtegel.",
		primaryAction: "Kamer openen",
		stats: "Kamercode",
	},
	"bluff-dice": {
		title: "Blufdobbelen",
		tagline: "Verborgen dobbelstenen, gedurfde claims",
		description:
			"Iedereen rolt verborgen dobbelstenen, de claims klimmen steeds hoger en één uitdaging onthult wie er blufte.",
		primaryAction: "Tafel openen",
		stats: "2-8 spelers",
	},
	"squad-surge": {
		title: "Squad Surge",
		tagline: "Laat je leger groeien, breek door de linie",
		description:
			"Stuur je squad door multiplier-poorten, overleef vijandelijke golven en overtref de eindbaas bij de finish.",
		primaryAction: "Squad inzetten",
		stats: "Solo",
	},
} satisfies Record<GameType, CatalogText>;
```

- [ ] **Step 3: Register in both indexes**

Add `catalog` to `en/index.ts` (`import { catalog } from "./catalog";` … `export const en = { common, catalog, games: {} };`) and identically in `nl/index.ts` (still `satisfies Messages`).

- [ ] **Step 4: Add the localizer hooks**

```tsx
// src/lib/i18n/catalog.ts
import { useCallback } from "react";
import {
	type GameCatalogItem,
	getVisibleGames,
} from "#/lib/games/catalog";
import { useI18n } from "./index";

/**
 * Returns a function that overlays localized catalog text onto a catalog
 * item. A function (not a per-item hook) so callers can localize inside
 * list renders without violating hook rules.
 */
export function useGameLocalizer() {
	const { messages } = useI18n();
	return useCallback(
		(game: GameCatalogItem): GameCatalogItem => ({
			...game,
			...messages.catalog[game.type],
		}),
		[messages],
	);
}

export function useLocalizedGames(): GameCatalogItem[] {
	const localize = useGameLocalizer();
	return getVisibleGames().map(localize);
}
```

- [ ] **Step 5: Switch the three consumers**

- `src/components/games/GameCatalog.tsx`: replace `getVisibleGames()` with `useLocalizedGames()` (call the hook at the top of the component, map over its result).
- `src/routes/games/$gameType.tsx`: `const localize = useGameLocalizer();` then `const base = getGameByType(gameType as GameType); const game = base ? localize(base) : undefined;`
- `src/routes/dashboard/index.tsx`: same pattern at both `getGameByType` call sites (lines ~71 and ~108) — get `localize` once at the top of the component, apply where the item is used for display.

Check `src/components/games/GameCard.tsx` receives the item as a prop (it renders whatever it's given — no change needed unless it calls catalog functions itself; if it does, apply the same pattern).

- [ ] **Step 6: Verify**

Run: `pnpm run typecheck && pnpm exec vitest run src/lib/games/__tests__/catalog.test.ts src/lib/i18n/__tests__/messages.test.ts`
Expected: PASS (catalog tests still assert the English base — untouched).
Browser: toggle NL on the home page — cards show "Schaken", "Vier op een rij", "Blufdobbelen", Dutch taglines/descriptions.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n/messages/en/catalog.ts src/lib/i18n/messages/nl/catalog.ts src/lib/i18n/catalog.ts src/lib/i18n/messages/en/index.ts src/lib/i18n/messages/nl/index.ts src/components/games/GameCatalog.tsx src/routes/games/\$gameType.tsx src/routes/dashboard/index.tsx
git commit -m "feat(i18n): localize games catalog with Dutch translations"
```

---

### Task 8: Shared game components + join flow (recipe batch)

Follow the **Shared string-extraction recipe**. Shared strings go into `common` groups (extend `common.session`, `common.errors`, or add `common.gameShell`), NOT into a per-game file.

**Files:**
- Modify: `src/components/games/FullscreenGameShell.tsx`, `FullscreenGamePage.tsx`, `GameCard.tsx`, `GameEndScreen.tsx`, `HostGate.tsx`, `JoinGamePanel.tsx`, `ParticipantList.tsx`, `QrSharePanel.tsx`, `SeatBanner.tsx`, `SessionHostControls.tsx`, `SessionShell.tsx`
- Modify: `src/routes/join.tsx`, `src/routes/games/$gameType.tsx`
- Modify: `src/lib/i18n/messages/en/common.ts`, `src/lib/i18n/messages/nl/common.ts`

- [ ] **Step 1: Extract all user-visible strings** from the files above into new/extended groups in `en/common.ts` (suggested groups: `gameShell` for pause-menu/fullscreen chrome, `joinPanel`, `endScreen`, `hostControls`; reuse existing `session`/`actions`/`errors` keys where the string already exists — do not duplicate).
- [ ] **Step 2: Author the Dutch translations** in `nl/common.ts` (glossary + informal tone).
- [ ] **Step 3: Replace literals** with `useMessages()` lookups + `fmt`/`plural` for dynamic parts.
- [ ] **Step 4: Verify:** `pnpm run typecheck && pnpm exec vitest run src/lib/i18n/__tests__/messages.test.ts && pnpm test`. Browser-check the join page and one game lobby in NL.
- [ ] **Step 5: Commit** the listed files: `feat(i18n): localize shared game components and join flow`.

---

### Task 9: Dashboard + results (recipe batch)

**Files:**
- Modify: `src/routes/dashboard/index.tsx`, `src/routes/dashboard/results.$sessionId.tsx`
- Modify: `src/lib/i18n/messages/en/common.ts`, `src/lib/i18n/messages/nl/common.ts` (add a `dashboard` group and a `results` group)

- [ ] **Step 1–5:** Apply the recipe. Dates/times shown on the dashboard or results must use `new Intl.DateTimeFormat(locale, …)` with `locale` from `useI18n()` instead of hardcoded `toLocaleString()` without a locale argument. Commit: `feat(i18n): localize dashboard and results`.

---

### Task 10: Quiz (recipe batch)

**Files:**
- Modify: `src/components/quiz/QuizHostView.tsx`, `QuizPlayerView.tsx`, `QuizSetEditor.tsx`, `QuizSetupForm.tsx`, `Scoreboard.tsx`
- Modify: `src/routes/quiz/index.tsx`, `new.tsx`, `$sessionId/host.tsx`, `$sessionId/play.tsx`, `sets/index.tsx`, `sets/new.tsx`, `sets/$quizSetId.tsx`
- Create: `src/lib/i18n/messages/en/games/quiz.ts`, `src/lib/i18n/messages/nl/games/quiz.ts`
- Modify: `src/lib/i18n/messages/en/index.ts`, `nl/index.ts` (register `games: { quiz }`)

- [ ] **Step 1–5:** Apply the recipe. Quiz *content* (question/answer text in quiz sets) is data, not UI — leave it alone. Commit: `feat(i18n): localize quiz`.

---

### Task 11: Backgammon (recipe batch)

**Files:**
- Modify: `src/components/backgammon/BackgammonBoard.tsx`, `BackgammonMoveLog.tsx`, `BackgammonWaitingRoom.tsx`
- Modify: `src/routes/backgammon/index.tsx`, `new.tsx`, `local.tsx`, `$sessionId.tsx`
- Create: `src/lib/i18n/messages/en/games/backgammon.ts`, `nl/games/backgammon.ts`; register in both indexes.

- [ ] **Step 1–5:** Apply the recipe. Move-log notation (point numbers, "bar", "off") is game notation — translate surrounding labels, keep notation itself as-is. Commit: `feat(i18n): localize backgammon`.

---

### Task 12: Sudoku (recipe batch)

**Files:**
- Modify: `src/components/sudoku/BinaryGame.tsx`, `SudokuBoard.tsx`, `SudokuGame.tsx`, `SudokuKeypad.tsx`, `SudokuScanFlow.tsx`
- Modify: `src/routes/sudoku/index.tsx`, `new.tsx`, `scan.tsx`, `$sessionId.tsx`
- Create: `src/lib/i18n/messages/en/games/sudoku.ts`, `nl/games/sudoku.ts`; register in both indexes.

- [ ] **Step 1–5:** Apply the recipe. Difficulty names use the glossary (makkelijk/gemiddeld/moeilijk; "expert" stays "expert"). Commit: `feat(i18n): localize sudoku`.

---

### Task 13: Chess + Connect Four (recipe batch)

**Files:**
- Modify: `src/components/chess/ChessMatch.tsx`, `src/components/connect-four/ConnectFourMatch.tsx`
- Modify: `src/routes/chess/index.tsx`, `new.tsx`, `$sessionId.tsx`, `src/routes/connect-four/index.tsx`, `new.tsx`, `$sessionId.tsx`
- Create: `en/games/chess.ts`, `nl/games/chess.ts`, `en/games/connectFour.ts`, `nl/games/connectFour.ts`; register in both indexes.

- [ ] **Step 1–5:** Apply the recipe. Chess piece names translate (koning, dame, toren, loper, paard, pion); algebraic notation (e4, Nf3) does not. Commit: `feat(i18n): localize chess and connect four`.

---

### Task 14: Hitster (recipe batch)

**Files:**
- Modify: `src/components/hitster/HitsterBits.tsx`, `HitsterHostView.tsx`, `HitsterSetupForm.tsx`, `HitsterStage.tsx`
- Modify: `src/routes/hitster/index.tsx`, `new.tsx`, `$sessionId/host.tsx`, `$sessionId/play.tsx`
- Create: `en/games/hitster.ts`, `nl/games/hitster.ts`; register in both indexes.

- [ ] **Step 1–5:** Apply the recipe. Song titles/artists from packs are content — leave alone. Commit: `feat(i18n): localize hitster`.

---

### Task 15: Word Links + Signal Words (recipe batch)

**Files:**
- Modify: `src/components/word-links/WordLinksGame.tsx`, `src/components/signal-words/SignalWordsRoom.tsx`
- Modify: `src/routes/word-links/index.tsx`, `$puzzleId.tsx`, `src/routes/signal-words/index.tsx`, `new.tsx`, `$sessionId.tsx`
- Create: `en/games/wordLinks.ts`, `nl/games/wordLinks.ts`, `en/games/signalWords.ts`, `nl/games/signalWords.ts`; register in both indexes.

- [ ] **Step 1–5:** Apply the recipe. Puzzle terms, group labels, and word-pack words are content — leave alone (English packs stay English until the follow-up content phase). Daily-puzzle dates use `Intl.DateTimeFormat(locale, …)`. Commit: `feat(i18n): localize word links and signal words`.

---

### Task 16: Bluff Dice + Squad Surge (recipe batch)

**Files:**
- Modify: `src/components/bluff-dice/BluffDiceRoom.tsx`, `src/components/squad-surge/SquadSurgeCanvas.tsx`
- Modify: `src/routes/bluff-dice/index.tsx`, `new.tsx`, `$sessionId.tsx`, `src/routes/squad-surge/index.tsx`, `play.tsx`
- Create: `en/games/bluffDice.ts`, `nl/games/bluffDice.ts`, `en/games/squadSurge.ts`, `nl/games/squadSurge.ts`; register in both indexes.

- [ ] **Step 1–5:** Apply the recipe. **Squad Surge special case:** text drawn inside the canvas render loop cannot call hooks. Read the needed strings once in the React component that owns the canvas (via `useMessages()`) and pass them into the render/setup function as a plain strings object parameter. If `src/lib/games/squad-surge-local.ts` contains display strings, move them out to the messages files and inject them the same way — game logic files must not import from `#/lib/i18n`. Commit: `feat(i18n): localize bluff dice and squad surge`.

---

### Task 17: Bootstrap skill update (repeatable pattern)

**Files (outside the repo — no git commit unless `~/.claude` is a repo; just write them):**
- Create: `C:\Users\ericj\.claude\skills\custom-bootstrap\i18n.md`
- Modify: `C:\Users\ericj\.claude\skills\custom-bootstrap\SKILL.md`

- [ ] **Step 1: Write `i18n.md`** with this structure, embedding the **final implemented code** from this repo (copy the real files — they are the tested template):

```markdown
# i18n — typed dictionary (on request)

Zero-dependency two-locale i18n for TanStack Start + Clerk apps. Apply only
when an app needs multiple languages. Locale resolution: `lang` cookie →
Clerk `unsafeMetadata.language` → `Accept-Language` → default.

## Files to scaffold

1. `src/lib/i18n/core.ts` — <embed full core.ts from this repo>
2. `src/lib/i18n/messages/en/{common.ts,index.ts}` + `nl/` twin — <embed a
   MINIMAL example: header/actions/errors groups only, NOT this app's full
   dictionary; keep the `satisfies` pattern and the `Messages` type>
3. `src/lib/i18n/index.tsx` — <embed full index.tsx>
4. `src/lib/i18n/server.ts` — <embed full server.ts>
5. `src/lib/i18n/LanguageSync.tsx` — <embed full LanguageSync.tsx>
6. `src/components/LanguageToggle.tsx` — <embed full LanguageToggle.tsx>
7. Tests: `src/lib/i18n/__tests__/core.test.ts` and `messages.test.ts` —
   <embed both full test files; messages.test.ts is app-agnostic>

## Root route wiring

<embed the __root.tsx diff from this repo: loader, html lang,
LocaleProvider placement, LanguageSync next to ThemeSync>

## String extraction recipe

<embed the "Shared string-extraction recipe" section from
docs/superpowers/plans/2026-07-08-webapp-i18n-dutch.md, minus the
game-specific glossary — glossaries are per-app>

## Notes

- Adding a locale: extend SUPPORTED_LOCALES, add a messages/<locale>/ tree
  (typecheck lists every missing file/key), extend LOCALE_NAMES in the toggle.
- Migrate to a library (react-i18next) only when locale count or external
  translators outgrow this; the message tree maps 1:1 onto JSON catalogs.
```

Replace each `<embed …>` with the actual file contents — no placeholders may remain in the written skill file.

- [ ] **Step 2: Add the step to SKILL.md.** Insert before the current `### 11. Wrap up`, renumbering Wrap up to `### 12.`:

```markdown
### 11. i18n — typed dictionary (on request)

Only when the app needs multiple languages (ask if unclear — most apps skip
this). Follow `i18n.md` in this skill directory: zero-dependency typed message
dictionaries (missing translations fail typecheck), cookie + Accept-Language
SSR locale resolution, header LanguageToggle, Clerk unsafeMetadata sync.
```

Then `grep -n "step 11\|step 12" SKILL.md` and fix any cross-references to the renumbered step.

- [ ] **Step 3: Verify** — reread the finished `i18n.md`: every `<embed>` replaced, code blocks compile-plausible, no references to Arcade Club specifics except as noted examples.

---

### Task 18: Final verification

- [ ] **Step 1: Full checks**

```bash
pnpm run typecheck && pnpm test && pnpm run check
```

Expected: all pass. Biome failures from new files: fix with `pnpm run lint:fix`, re-run.

- [ ] **Step 2: Full-sweep string scan**

```bash
grep -rn ">[A-Z][a-z]" src/components src/routes --include="*.tsx" | grep -v "className\|import\|//" | head -50
```

Review hits for missed user-visible literals (expect false positives: brand names, notation, content data). Fix real misses via the recipe (add to the relevant batch's message files, amend or new commit).

- [ ] **Step 3: Browser smoke test (dev server)**

In NL: home page, join flow, one room-based game lobby (quiz or signal words), one challenge game (chess), one solo game (sudoku), dashboard. Toggle back to EN, confirm no stuck Dutch strings. Confirm reload keeps the chosen language and `<html lang>` matches.

- [ ] **Step 4: Commit any fixes**, then report done with test output.

---

## Self-review notes

- **Spec coverage:** typed dictionary + parity (Tasks 1–3), SSR cookie resolution (Task 4), header toggle + Clerk sync for guests/users (Task 5), shell + catalog + all-games extraction (Tasks 6–16), bootstrap skill (Task 17), testing (Tasks 1, 2, 18). Exclusions honored: no Convex error migration (only client fallbacks localized via `common.errors`), no `@appelent/auth` changes, no content translation.
- **Consistency:** exported names used throughout: `fmt`, `plural`, `resolveLocale`, `isLocale`, `LANG_COOKIE`, `Locale`, `Messages`, `LocaleProvider`, `useI18n`, `useMessages`, `readClientLocale`, `hasExplicitLocaleChoice`, `getSsrLocale`, `LanguageSync`, `useGameLocalizer`, `useLocalizedGames`.
- **Known judgment calls for the executor:** exact key names inside per-game message files are discovered at extraction time (the strings live in ~40 components; the recipe fixes structure and naming rules, not the key list). Dutch translations for batch tasks follow the glossary; when a phrase is ambiguous, translate meaning and keep UI length similar.

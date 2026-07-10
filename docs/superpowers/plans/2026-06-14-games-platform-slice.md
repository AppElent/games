# Games Platform Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable Arcade Club slice: game catalog, reusable game sessions, Live Quiz MVP, and Backgammon challenge-link waiting flow.

**Architecture:** Convex owns live session and game state. React routes render game-specific flows on top of a shared session foundation, with pure logic in `src/lib/games/*` and UI split into focused components. This plan deliberately excludes full playable Backgammon rules and board movement; that is a separate follow-up plan after choosing or rejecting a rules package.

**Tech Stack:** React 19, TanStack Start/Router, Convex, Clerk, Tailwind CSS v4, Lucide React, Vitest, Biome.

---

## Scope Check

The approved spec covers several independent subsystems: shared sessions, Live Quiz, Backgammon, and future games. This plan covers the first cohesive slice:

- Arcade Club shell and game catalog.
- Shared game session schema, helpers, and create/join flows.
- Live Quiz end to end as the first room-style game.
- Backgammon challenge creation, QR/share link, seat claiming, and waiting screen.

Full Backgammon rules, dice movement, legal move enforcement, doubling cube, and win detection are intentionally excluded from this plan and should get their own plan.

## File Structure

Create and modify these files:

- Modify `package.json`: add `qrcode`, `@types/qrcode`, `dev:all`, and `test:watch`.
- Modify `convex/schema.ts`: replace scaffold tables with game session, participant, quiz, and backgammon challenge state tables.
- Create `convex/lib/auth.ts`: shared Clerk identity helpers for optional auth and required signed-in ownership.
- Create `convex/lib/codes.ts`: join code and share token helpers.
- Create `convex/sessions.ts`: session creation, join, list, bundle, participant heartbeats, and status mutations.
- Create `convex/quiz.ts`: quiz set seed/list/create helpers and live quiz state mutations.
- Create `convex/backgammon.ts`: challenge creation, seat claiming, and rematch-ready waiting state.
- Create `src/lib/games/catalog.ts`: static catalog metadata and route helpers.
- Create `src/lib/games/sessions.ts`: client-side session helpers and local guest identity helpers.
- Create `src/lib/games/quiz.ts`: quiz scoring, phase, and answer helpers.
- Create `src/lib/games/__tests__/catalog.test.ts`: catalog metadata tests.
- Create `src/lib/games/__tests__/sessions.test.ts`: local guest/session helper tests.
- Create `src/lib/games/__tests__/quiz.test.ts`: quiz scoring and phase tests.
- Modify `src/routes/__root.tsx`: app title, shell, providers, and devtools cleanup.
- Modify `src/components/Header.tsx`: Arcade Club navigation and join entry point.
- Modify `src/components/Footer.tsx`: lean product footer or remove from game screens if intrusive.
- Modify `src/styles.css`: replace starter island theme with Arcade Club tokens.
- Modify `src/routes/index.tsx`: game catalog and join panel.
- Create `src/routes/dashboard/index.tsx`: signed-in hub shell.
- Create `src/routes/join.tsx`: code/link entry route.
- Create `src/routes/games/$gameType.tsx`: future game detail pages.
- Create `src/routes/quiz/new.tsx`: quiz setup.
- Create `src/routes/quiz/$sessionId/host.tsx`: host screen.
- Create `src/routes/quiz/$sessionId/play.tsx`: player screen.
- Create `src/routes/backgammon/new.tsx`: create challenge and display share panel.
- Create `src/routes/backgammon/$sessionId.tsx`: seat claim and waiting screen.
- Create `src/components/games/GameCatalog.tsx`, `GameCard.tsx`, `JoinGamePanel.tsx`, `QrSharePanel.tsx`, `ParticipantList.tsx`, `SessionShell.tsx`, `SeatBanner.tsx`.
- Create `src/components/quiz/*`: setup form, host view, player view, answer pad, scoreboard.
- Create `src/components/backgammon/*`: waiting board, share panel, move log shell.

## Shared Type Names

Use these names consistently:

```ts
export type GameType =
	| "live-quiz"
	| "backgammon"
	| "sudoku"
	| "chess"
	| "hitster"
	| "word-games";

export type JoinMode = "room" | "challenge" | "solo";
export type AuthPolicy = "guestAllowed" | "signedInRequired" | "hostChoice";
export type SessionStatus = "lobby" | "active" | "completed" | "cancelled";
export type ParticipantRole = "host" | "player" | "watcher";
export type QuizPhase = "lobby" | "question" | "reveal" | "scoreboard" | "finished";
```

---

### Task 1: Add Game Catalog Metadata

**Files:**
- Create: `src/lib/games/catalog.ts`
- Test: `src/lib/games/__tests__/catalog.test.ts`

- [ ] **Step 1: Write the failing catalog tests**

Create `src/lib/games/__tests__/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	GAME_CATALOG,
	getGameByType,
	getPlayableGames,
	getVisibleGames,
} from "../catalog";

describe("game catalog", () => {
	it("lists live quiz and backgammon as playable games", () => {
		expect(getPlayableGames().map((game) => game.type)).toEqual([
			"live-quiz",
			"backgammon",
		]);
	});

	it("keeps future games visible but not playable", () => {
		const visibleTypes = getVisibleGames().map((game) => game.type);
		expect(visibleTypes).toContain("sudoku");
		expect(visibleTypes).toContain("chess");
		expect(visibleTypes).toContain("hitster");
		expect(getGameByType("sudoku")?.availability).toBe("coming-soon");
	});

	it("uses room mode for quiz and challenge mode for backgammon", () => {
		expect(getGameByType("live-quiz")?.joinMode).toBe("room");
		expect(getGameByType("backgammon")?.joinMode).toBe("challenge");
	});

	it("has stable unique game types", () => {
		const types = GAME_CATALOG.map((game) => game.type);
		expect(new Set(types).size).toBe(types.length);
	});
});
```

- [ ] **Step 2: Run the catalog test to verify it fails**

Run:

```bash
npx vitest run src/lib/games/__tests__/catalog.test.ts
```

Expected: fail because `src/lib/games/catalog.ts` does not exist.

- [ ] **Step 3: Implement catalog metadata**

Create `src/lib/games/catalog.ts`:

```ts
import {
	Brain,
	ChartNoAxesColumnIncreasing,
	CircleDot,
	Dices,
	Gamepad2,
	Grid3X3,
	Music,
	Trophy,
} from "lucide-react";
import type { ComponentType } from "react";

export type GameType =
	| "live-quiz"
	| "backgammon"
	| "sudoku"
	| "chess"
	| "hitster"
	| "word-games";

export type JoinMode = "room" | "challenge" | "solo";
export type AuthPolicy = "guestAllowed" | "signedInRequired" | "hostChoice";
export type GameAvailability = "playable" | "coming-soon";

export type GameCatalogItem = {
	type: GameType;
	title: string;
	tagline: string;
	description: string;
	joinMode: JoinMode;
	authPolicy: AuthPolicy;
	availability: GameAvailability;
	accent: string;
	icon: ComponentType<{ className?: string }>;
	primaryAction: string;
	route: string;
	stats: string;
};

export const GAME_CATALOG: GameCatalogItem[] = [
	{
		type: "live-quiz",
		title: "Live Quiz",
		tagline: "Host-led quiz nights",
		description:
			"Run a room, show questions on the big screen, and let everyone answer from their own device.",
		joinMode: "room",
		authPolicy: "hostChoice",
		availability: "playable",
		accent: "from-emerald-400 to-cyan-300",
		icon: Trophy,
		primaryAction: "Host quiz",
		route: "/quiz/new",
		stats: "Room code",
	},
	{
		type: "backgammon",
		title: "Backgammon",
		tagline: "Two-player challenge",
		description:
			"Start a board, share a link or QR code, and let your opponent claim the second seat.",
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		availability: "playable",
		accent: "from-fuchsia-400 to-orange-300",
		icon: Dices,
		primaryAction: "Start match",
		route: "/backgammon/new",
		stats: "Share link",
	},
	{
		type: "sudoku",
		title: "Sudoku",
		tagline: "Daily puzzle runs",
		description: "Solo puzzles, timed challenges, and shared races.",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		availability: "coming-soon",
		accent: "from-sky-400 to-blue-500",
		icon: Grid3X3,
		primaryAction: "Preview",
		route: "/games/sudoku",
		stats: "Solo",
	},
	{
		type: "chess",
		title: "Chess",
		tagline: "Direct board duels",
		description: "Share a challenge link and play a clean real-time match.",
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		availability: "coming-soon",
		accent: "from-violet-400 to-indigo-400",
		icon: Brain,
		primaryAction: "Preview",
		route: "/games/chess",
		stats: "2 players",
	},
	{
		type: "hitster",
		title: "Hitster",
		tagline: "Music timeline party",
		description:
			"Host a music round and place songs on a shared timeline with friends.",
		joinMode: "room",
		authPolicy: "hostChoice",
		availability: "coming-soon",
		accent: "from-pink-400 to-rose-300",
		icon: Music,
		primaryAction: "Preview",
		route: "/games/hitster",
		stats: "Party",
	},
	{
		type: "word-games",
		title: "Word Games",
		tagline: "Quick brain sparks",
		description: "Fast shared word rounds for calls, parties, and breaks.",
		joinMode: "room",
		authPolicy: "guestAllowed",
		availability: "coming-soon",
		accent: "from-lime-300 to-emerald-400",
		icon: CircleDot,
		primaryAction: "Preview",
		route: "/games/word-games",
		stats: "Fast play",
	},
];

export function getVisibleGames() {
	return GAME_CATALOG;
}

export function getPlayableGames() {
	return GAME_CATALOG.filter((game) => game.availability === "playable");
}

export function getGameByType(type: GameType) {
	return GAME_CATALOG.find((game) => game.type === type);
}

export function getCatalogIcon() {
	return Gamepad2;
}

export function getCatalogStatsIcon() {
	return ChartNoAxesColumnIncreasing;
}
```

- [ ] **Step 4: Run the catalog test to verify it passes**

Run:

```bash
npx vitest run src/lib/games/__tests__/catalog.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit catalog metadata**

Run:

```bash
git add src/lib/games/catalog.ts src/lib/games/__tests__/catalog.test.ts
git commit -m "feat: add games catalog metadata"
```

---

### Task 2: Add Client Session Helpers

**Files:**
- Create: `src/lib/games/sessions.ts`
- Test: `src/lib/games/__tests__/sessions.test.ts`

- [ ] **Step 1: Write the failing session helper tests**

Create `src/lib/games/__tests__/sessions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	buildShareUrl,
	formatJoinCode,
	getGuestDisplayName,
	isJoinCodeLike,
	normalizeJoinCode,
} from "../sessions";

describe("session helpers", () => {
	it("normalizes room codes to uppercase alphanumeric text", () => {
		expect(normalizeJoinCode(" ab-12 ")).toBe("AB12");
		expect(normalizeJoinCode("quiz 88")).toBe("QUIZ88");
	});

	it("formats long room codes for display", () => {
		expect(formatJoinCode("ABCD12")).toBe("ABC D12");
		expect(formatJoinCode("AB12")).toBe("AB12");
	});

	it("detects plausible join codes", () => {
		expect(isJoinCodeLike("ABC123")).toBe(true);
		expect(isJoinCodeLike("A")).toBe(false);
		expect(isJoinCodeLike("too-long-code")).toBe(false);
	});

	it("creates stable guest display names from ids", () => {
		expect(getGuestDisplayName("guest_0001")).toBe("Player 001");
		expect(getGuestDisplayName("guest_9876")).toBe("Player 876");
	});

	it("builds share urls without duplicate slashes", () => {
		expect(buildShareUrl("https://games.test/", "share_abc")).toBe(
			"https://games.test/join?token=share_abc",
		);
	});
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npx vitest run src/lib/games/__tests__/sessions.test.ts
```

Expected: fail because `src/lib/games/sessions.ts` does not exist.

- [ ] **Step 3: Implement session helpers**

Create `src/lib/games/sessions.ts`:

```ts
export type LocalGuestIdentity = {
	id: string;
	displayName: string;
	createdAt: number;
};

const GUEST_KEY = "arcade-club.guest";

export function normalizeJoinCode(value: string) {
	return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function formatJoinCode(value: string) {
	const normalized = normalizeJoinCode(value);
	if (normalized.length <= 4) {
		return normalized;
	}
	return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

export function isJoinCodeLike(value: string) {
	const normalized = normalizeJoinCode(value);
	return normalized.length >= 4 && normalized.length <= 8;
}

export function getGuestDisplayName(guestId: string) {
	const digits = guestId.replace(/\D/g, "").slice(-3).padStart(3, "0");
	return `Player ${digits}`;
}

export function createGuestIdentity(now = Date.now()): LocalGuestIdentity {
	const suffix =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID().slice(0, 8)
			: Math.floor(Math.random() * 1_000_000)
					.toString()
					.padStart(6, "0");
	const id = `guest_${suffix}`;
	return {
		id,
		displayName: getGuestDisplayName(id),
		createdAt: now,
	};
}

export function getOrCreateGuestIdentity(storage = window.localStorage) {
	const existing = storage.getItem(GUEST_KEY);
	if (existing) {
		return JSON.parse(existing) as LocalGuestIdentity;
	}
	const identity = createGuestIdentity();
	storage.setItem(GUEST_KEY, JSON.stringify(identity));
	return identity;
}

export function buildShareUrl(origin: string, token: string) {
	const base = origin.replace(/\/$/, "");
	return `${base}/join?token=${encodeURIComponent(token)}`;
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npx vitest run src/lib/games/__tests__/sessions.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit session helpers**

Run:

```bash
git add src/lib/games/sessions.ts src/lib/games/__tests__/sessions.test.ts
git commit -m "feat: add client session helpers"
```

---

### Task 3: Add Live Quiz Pure Logic

**Files:**
- Create: `src/lib/games/quiz.ts`
- Test: `src/lib/games/__tests__/quiz.test.ts`

- [ ] **Step 1: Write the failing quiz logic tests**

Create `src/lib/games/__tests__/quiz.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	calculateAnswerScore,
	getNextQuizPhase,
	isCorrectAnswer,
	summarizeScores,
} from "../quiz";

describe("quiz logic", () => {
	it("checks single-choice answers", () => {
		expect(isCorrectAnswer(["a"], ["a"])).toBe(true);
		expect(isCorrectAnswer(["a"], ["b"])).toBe(false);
	});

	it("checks multi-choice answers without depending on order", () => {
		expect(isCorrectAnswer(["a", "c"], ["c", "a"])).toBe(true);
		expect(isCorrectAnswer(["a", "b"], ["a", "c"])).toBe(false);
	});

	it("awards points for correct answers and zero for incorrect answers", () => {
		expect(calculateAnswerScore({ correct: true, basePoints: 1000 })).toBe(
			1000,
		);
		expect(calculateAnswerScore({ correct: false, basePoints: 1000 })).toBe(0);
	});

	it("applies a time bonus when timing data exists", () => {
		expect(
			calculateAnswerScore({
				correct: true,
				basePoints: 1000,
				answeredInMs: 5_000,
				questionDurationMs: 20_000,
			}),
		).toBe(1250);
	});

	it("summarizes scores by participant", () => {
		expect(
			summarizeScores([
				{ participantId: "p1", score: 100 },
				{ participantId: "p2", score: 300 },
				{ participantId: "p1", score: 50 },
			]),
		).toEqual([
			{ participantId: "p2", score: 300 },
			{ participantId: "p1", score: 150 },
		]);
	});

	it("moves quiz phases in host-controlled order", () => {
		expect(getNextQuizPhase("lobby")).toBe("question");
		expect(getNextQuizPhase("question")).toBe("reveal");
		expect(getNextQuizPhase("reveal")).toBe("scoreboard");
		expect(getNextQuizPhase("scoreboard")).toBe("question");
		expect(getNextQuizPhase("finished")).toBe("finished");
	});
});
```

- [ ] **Step 2: Run the quiz logic test to verify it fails**

Run:

```bash
npx vitest run src/lib/games/__tests__/quiz.test.ts
```

Expected: fail because `src/lib/games/quiz.ts` does not exist.

- [ ] **Step 3: Implement quiz logic**

Create `src/lib/games/quiz.ts`:

```ts
export type QuizPhase =
	| "lobby"
	| "question"
	| "reveal"
	| "scoreboard"
	| "finished";

export type ScoredAnswer = {
	participantId: string;
	score: number;
};

export function isCorrectAnswer(selected: string[], correct: string[]) {
	if (selected.length !== correct.length) {
		return false;
	}
	const selectedSet = new Set(selected);
	return correct.every((answer) => selectedSet.has(answer));
}

export function calculateAnswerScore({
	correct,
	basePoints,
	answeredInMs,
	questionDurationMs,
}: {
	correct: boolean;
	basePoints: number;
	answeredInMs?: number;
	questionDurationMs?: number;
}) {
	if (!correct) {
		return 0;
	}
	if (!answeredInMs || !questionDurationMs || questionDurationMs <= 0) {
		return basePoints;
	}
	const remainingRatio = Math.max(
		0,
		Math.min(1, (questionDurationMs - answeredInMs) / questionDurationMs),
	);
	return Math.round(basePoints + basePoints * 0.5 * remainingRatio);
}

export function summarizeScores(answers: ScoredAnswer[]) {
	const totals = new Map<string, number>();
	for (const answer of answers) {
		totals.set(
			answer.participantId,
			(totals.get(answer.participantId) ?? 0) + answer.score,
		);
	}
	return Array.from(totals, ([participantId, score]) => ({
		participantId,
		score,
	})).sort((a, b) => b.score - a.score);
}

export function getNextQuizPhase(phase: QuizPhase) {
	switch (phase) {
		case "lobby":
			return "question";
		case "question":
			return "reveal";
		case "reveal":
			return "scoreboard";
		case "scoreboard":
			return "question";
		case "finished":
			return "finished";
	}
}
```

- [ ] **Step 4: Run quiz logic tests**

Run:

```bash
npx vitest run src/lib/games/__tests__/quiz.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit quiz logic**

Run:

```bash
git add src/lib/games/quiz.ts src/lib/games/__tests__/quiz.test.ts
git commit -m "feat: add live quiz logic"
```

---

### Task 4: Replace Convex Scaffold Schema With Game Tables

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Replace `convex/schema.ts`**

Use this schema:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const gameTypeValidator = v.union(
	v.literal("live-quiz"),
	v.literal("backgammon"),
	v.literal("sudoku"),
	v.literal("chess"),
	v.literal("hitster"),
	v.literal("word-games"),
);

export const joinModeValidator = v.union(
	v.literal("room"),
	v.literal("challenge"),
	v.literal("solo"),
);

export const authPolicyValidator = v.union(
	v.literal("guestAllowed"),
	v.literal("signedInRequired"),
	v.literal("hostChoice"),
);

export const sessionStatusValidator = v.union(
	v.literal("lobby"),
	v.literal("active"),
	v.literal("completed"),
	v.literal("cancelled"),
);

export const participantRoleValidator = v.union(
	v.literal("host"),
	v.literal("player"),
	v.literal("watcher"),
);

export const quizPhaseValidator = v.union(
	v.literal("lobby"),
	v.literal("question"),
	v.literal("reveal"),
	v.literal("scoreboard"),
	v.literal("finished"),
);

export const quizQuestionValidator = v.object({
	id: v.string(),
	prompt: v.string(),
	choices: v.array(
		v.object({
			id: v.string(),
			label: v.string(),
		}),
	),
	correctChoiceIds: v.array(v.string()),
	durationSeconds: v.number(),
	points: v.number(),
});

export default defineSchema({
	gameSessions: defineTable({
		gameType: gameTypeValidator,
		status: sessionStatusValidator,
		joinMode: joinModeValidator,
		authPolicy: authPolicyValidator,
		title: v.string(),
		hostUserId: v.optional(v.string()),
		hostParticipantId: v.optional(v.id("sessionParticipants")),
		joinCode: v.optional(v.string()),
		shareToken: v.optional(v.string()),
		settings: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
		startedAt: v.optional(v.number()),
		endedAt: v.optional(v.number()),
	})
		.index("by_joinCode", ["joinCode"])
		.index("by_shareToken", ["shareToken"])
		.index("by_hostUser", ["hostUserId"])
		.index("by_game_status", ["gameType", "status"]),

	sessionParticipants: defineTable({
		sessionId: v.id("gameSessions"),
		userId: v.optional(v.string()),
		guestId: v.optional(v.string()),
		displayName: v.string(),
		role: participantRoleValidator,
		seat: v.optional(v.string()),
		connected: v.boolean(),
		lastSeen: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_session_seat", ["sessionId", "seat"])
		.index("by_user", ["userId"])
		.index("by_guest", ["guestId"]),

	quizSets: defineTable({
		ownerUserId: v.optional(v.string()),
		title: v.string(),
		description: v.optional(v.string()),
		questions: v.array(quizQuestionValidator),
		isSample: v.boolean(),
	}).index("by_owner", ["ownerUserId"]),

	liveQuizStates: defineTable({
		sessionId: v.id("gameSessions"),
		quizSetId: v.optional(v.id("quizSets")),
		phase: quizPhaseValidator,
		currentQuestionIndex: v.number(),
		questionStartedAt: v.optional(v.number()),
		showCorrectAnswer: v.boolean(),
	})
		.index("by_session", ["sessionId"])
		.index("by_quizSet", ["quizSetId"]),

	liveQuizAnswers: defineTable({
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		questionId: v.string(),
		selectedChoiceIds: v.array(v.string()),
		correct: v.boolean(),
		score: v.number(),
		answeredAt: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_session_question", ["sessionId", "questionId"])
		.index("by_participant", ["participantId"]),

	backgammonStates: defineTable({
		sessionId: v.id("gameSessions"),
		phase: v.union(
			v.literal("waiting"),
			v.literal("ready"),
			v.literal("active"),
			v.literal("finished"),
		),
		whiteParticipantId: v.optional(v.id("sessionParticipants")),
		blackParticipantId: v.optional(v.id("sessionParticipants")),
		winnerParticipantId: v.optional(v.id("sessionParticipants")),
		moveLog: v.array(v.string()),
	})
		.index("by_session", ["sessionId"])
		.index("by_white", ["whiteParticipantId"])
		.index("by_black", ["blackParticipantId"]),
});
```

- [ ] **Step 2: Regenerate Convex types**

Run:

```bash
npx convex dev --once
```

Expected: Convex typecheck succeeds and `convex/_generated/*` updates.

- [ ] **Step 3: Commit schema**

Run:

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: add games convex schema"
```

---

### Task 5: Add Convex Session Functions

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `convex/lib/auth.ts`
- Create: `convex/lib/codes.ts`
- Create: `convex/sessions.ts`

- [ ] **Step 1: Add auth helpers**

Create `convex/lib/auth.ts`:

```ts
import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function getOptionalUserId(ctx: Ctx) {
	const identity = await ctx.auth.getUserIdentity();
	return identity?.subject;
}

export async function requireUserId(ctx: Ctx) {
	const userId = await getOptionalUserId(ctx);
	if (!userId) {
		throw new Error("Sign in required");
	}
	return userId;
}
```

- [ ] **Step 2: Add code helpers**

Create `convex/lib/codes.ts`:

```ts
const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeJoinCode(length = 6) {
	let code = "";
	for (let index = 0; index < length; index += 1) {
		code += JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)];
	}
	return code;
}

export function makeShareToken() {
	return `share_${crypto.randomUUID().replace(/-/g, "")}`;
}
```

- [ ] **Step 3: Add session mutations and queries**

Create `convex/sessions.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
	authPolicyValidator,
	gameTypeValidator,
	joinModeValidator,
} from "./schema";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { makeJoinCode, makeShareToken } from "./lib/codes";

export const create = mutation({
	args: {
		gameType: gameTypeValidator,
		joinMode: joinModeValidator,
		authPolicy: authPolicyValidator,
		title: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getOptionalUserId(ctx);
		if (args.authPolicy === "signedInRequired" && !userId) {
			throw new Error("Sign in required to create this game");
		}

		let joinCode: string | undefined;
		if (args.joinMode === "room") {
			for (let attempt = 0; attempt < 8; attempt += 1) {
				const candidate = makeJoinCode();
				const existing = await ctx.db
					.query("gameSessions")
					.withIndex("by_joinCode", (q) => q.eq("joinCode", candidate))
					.unique();
				if (!existing) {
					joinCode = candidate;
					break;
				}
			}
			if (!joinCode) {
				throw new Error("Could not create a join code");
			}
		}

		const sessionId = await ctx.db.insert("gameSessions", {
			gameType: args.gameType,
			status: "lobby",
			joinMode: args.joinMode,
			authPolicy: args.authPolicy,
			title: args.title,
			hostUserId: userId,
			joinCode,
			shareToken: args.joinMode === "challenge" ? makeShareToken() : undefined,
		});

		const participantId = await ctx.db.insert("sessionParticipants", {
			sessionId,
			userId,
			guestId: userId ? undefined : args.guestId,
			displayName: args.displayName,
			role: "host",
			seat: "host",
			connected: true,
			lastSeen: Date.now(),
		});

		await ctx.db.patch(sessionId, { hostParticipantId: participantId });

		return { sessionId, participantId, joinCode };
	},
});

export const joinByCode = mutation({
	args: {
		joinCode: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const normalized = args.joinCode.replace(/[^a-z0-9]/gi, "").toUpperCase();
		const session = await ctx.db
			.query("gameSessions")
			.withIndex("by_joinCode", (q) => q.eq("joinCode", normalized))
			.unique();
		if (!session || session.status === "completed" || session.status === "cancelled") {
			throw new Error("Game is unavailable");
		}
		const userId = await getOptionalUserId(ctx);
		if (session.authPolicy === "signedInRequired" && !userId) {
			throw new Error("Sign in required to join this game");
		}

		const participantId = await ctx.db.insert("sessionParticipants", {
			sessionId: session._id,
			userId,
			guestId: userId ? undefined : args.guestId,
			displayName: args.displayName,
			role: "player",
			connected: true,
			lastSeen: Date.now(),
		});

		return { sessionId: session._id, participantId, gameType: session.gameType };
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		return { session, participants };
	},
});

export const listMine = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return await ctx.db
			.query("gameSessions")
			.withIndex("by_hostUser", (q) => q.eq("hostUserId", userId))
			.order("desc")
			.take(20);
	},
});

export const heartbeat = mutation({
	args: { participantId: v.id("sessionParticipants") },
	handler: async (ctx, args) => {
		const participant = await ctx.db.get(args.participantId);
		if (!participant) {
			throw new Error("Participant not found");
		}
		await ctx.db.patch(args.participantId, {
			connected: true,
			lastSeen: Date.now(),
		});
	},
});
```

- [ ] **Step 4: Run Convex typecheck**

Run:

```bash
npx convex dev --once
```

Expected: pass.

- [ ] **Step 5: Commit session functions**

Run:

```bash
git add package.json package-lock.json convex/lib/auth.ts convex/lib/codes.ts convex/sessions.ts convex/_generated
git commit -m "feat: add game session functions"
```

---

### Task 6: Add Arcade Club Shell And Catalog UI

**Files:**
- Modify: `src/styles.css`
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/routes/index.tsx`
- Create: `src/components/games/GameCatalog.tsx`
- Create: `src/components/games/GameCard.tsx`
- Create: `src/components/games/JoinGamePanel.tsx`

- [ ] **Step 1: Replace global style tokens**

Modify `src/styles.css` to keep Tailwind imports and replace the starter color system with Arcade Club tokens:

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
@import 'tailwindcss';
@plugin '@tailwindcss/typography';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  --club-bg: #080a12;
  --club-panel: rgba(18, 22, 38, 0.82);
  --club-panel-strong: rgba(25, 31, 52, 0.94);
  --club-line: rgba(148, 163, 184, 0.18);
  --club-text: #f8fafc;
  --club-muted: #aab6cc;
  --club-soft: #64748b;
  --club-green: #34d399;
  --club-cyan: #22d3ee;
  --club-pink: #f472b6;
  --club-orange: #fb923c;
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --border: oklch(0.274 0.006 286.033);
  --ring: oklch(0.705 0.015 286.067);
}

@theme inline {
  --font-sans: 'Manrope', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
  color: var(--club-text);
  font-family: var(--font-sans);
  background:
    radial-gradient(900px 460px at 12% -8%, rgba(34, 211, 238, 0.22), transparent 58%),
    radial-gradient(760px 420px at 88% 4%, rgba(244, 114, 182, 0.18), transparent 62%),
    linear-gradient(180deg, #080a12 0%, #111827 52%, #080a12 100%);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: inherit;
}

button,
a {
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.club-wrap {
  width: min(1180px, calc(100% - 2rem));
  margin-inline: auto;
}

.club-panel {
  border: 1px solid var(--club-line);
  background: linear-gradient(160deg, var(--club-panel-strong), var(--club-panel));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
}

.club-title {
  font-family: var(--font-display);
  letter-spacing: 0;
}

.club-kicker {
  color: var(--club-green);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
```

- [ ] **Step 2: Update document title**

In `src/routes/__root.tsx`, change the head title to `Arcade Club` and remove `StoreDevtools` import/plugin if demo store files are deleted in a cleanup task. Keep Clerk, Convex, router devtools, query devtools, and theme init.

- [ ] **Step 3: Add `GameCard`**

Create `src/components/games/GameCard.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import type { GameCatalogItem } from "#/lib/games/catalog";

export function GameCard({ game }: { game: GameCatalogItem }) {
	const Icon = game.icon;
	const disabled = game.availability !== "playable";

	return (
		<article className="club-panel group flex min-h-[260px] flex-col justify-between rounded-lg p-5">
			<div>
				<div
					className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${game.accent} text-slate-950 shadow-lg`}
				>
					<Icon className="h-6 w-6" />
				</div>
				<div className="mb-2 flex items-center justify-between gap-3">
					<h2 className="club-title text-xl font-bold text-white">{game.title}</h2>
					<span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-300">
						{game.stats}
					</span>
				</div>
				<p className="mb-3 text-sm font-semibold text-cyan-200">{game.tagline}</p>
				<p className="text-sm leading-6 text-slate-300">{game.description}</p>
			</div>
			<Link
				to={game.route}
				className={`mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-bold no-underline ${
					disabled
						? "border border-white/10 bg-white/5 text-slate-400"
						: "bg-white text-slate-950 hover:-translate-y-0.5 hover:bg-cyan-100"
				}`}
			>
				{disabled ? "Coming soon" : game.primaryAction}
			</Link>
		</article>
	);
}
```

- [ ] **Step 4: Add `GameCatalog`**

Create `src/components/games/GameCatalog.tsx`:

```tsx
import { getVisibleGames } from "#/lib/games/catalog";
import { GameCard } from "./GameCard";

export function GameCatalog() {
	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{getVisibleGames().map((game) => (
				<GameCard key={game.type} game={game} />
			))}
		</section>
	);
}
```

- [ ] **Step 5: Add `JoinGamePanel`**

Create `src/components/games/JoinGamePanel.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { normalizeJoinCode } from "#/lib/games/sessions";

export function JoinGamePanel() {
	const navigate = useNavigate();
	const [code, setCode] = useState("");

	return (
		<form
			className="club-panel rounded-lg p-4"
			onSubmit={(event) => {
				event.preventDefault();
				const joinCode = normalizeJoinCode(code);
				if (joinCode) {
					void navigate({ to: "/join", search: { code: joinCode } });
				}
			}}
		>
			<label className="mb-2 block text-sm font-bold text-white" htmlFor="join-code">
				Join a game
			</label>
			<div className="flex gap-2">
				<input
					id="join-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder="Room code"
					className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
				/>
				<button
					type="submit"
					className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200"
				>
					Join
				</button>
			</div>
		</form>
	);
}
```

- [ ] **Step 6: Replace home route**

Modify `src/routes/index.tsx`:

```tsx
import { Link, createFileRoute } from "@tanstack/react-router";
import { GameCatalog } from "#/components/games/GameCatalog";
import { JoinGamePanel } from "#/components/games/JoinGamePanel";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
	return (
		<main className="club-wrap pb-12 pt-10">
			<section className="grid gap-6 pb-8 lg:grid-cols-[1fr_360px] lg:items-end">
				<div>
					<p className="club-kicker mb-3">Arcade Club</p>
					<h1 className="club-title max-w-4xl text-5xl font-bold leading-none text-white sm:text-7xl">
						Start a room, share a link, play together.
					</h1>
					<p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
						Live quiz nights, direct board-game challenges, and a growing shelf
						of party games for the next call, classroom, or couch session.
					</p>
					<div className="mt-7 flex flex-wrap gap-3">
						<Link
							to="/quiz/new"
							className="rounded-md bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 no-underline hover:-translate-y-0.5 hover:bg-cyan-200"
						>
							Host quiz
						</Link>
						<Link
							to="/backgammon/new"
							className="rounded-md border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white no-underline hover:-translate-y-0.5 hover:bg-white/15"
						>
							Start backgammon
						</Link>
					</div>
				</div>
				<JoinGamePanel />
			</section>
			<GameCatalog />
		</main>
	);
}
```

- [ ] **Step 7: Run check and build**

Run:

```bash
npm run check
npm run build
```

Expected: both pass. If route generation is needed, run `npm run generate-routes` and include `src/routeTree.gen.ts`.

- [ ] **Step 8: Commit Arcade Club shell**

Run:

```bash
git add src/styles.css src/routes/__root.tsx src/routes/index.tsx src/components/Header.tsx src/components/Footer.tsx src/components/games src/routeTree.gen.ts
git commit -m "feat: add arcade club catalog shell"
```

---

### Task 7: Add Join And Share UI Components

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/games/QrSharePanel.tsx`
- Create: `src/components/games/ParticipantList.tsx`
- Create: `src/components/games/SessionShell.tsx`
- Create: `src/components/games/SeatBanner.tsx`
- Create: `src/routes/join.tsx`

- [ ] **Step 1: Install QR dependency**

Run:

```bash
npm install qrcode
npm install -D @types/qrcode
```

Expected: `package.json` and `package-lock.json` include `qrcode` and `@types/qrcode`.

- [ ] **Step 2: Add `QrSharePanel`**

Create `src/components/games/QrSharePanel.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Copy, Link as LinkIcon } from "lucide-react";
import QRCode from "qrcode";

export function QrSharePanel({ url, label }: { url: string; label: string }) {
	const [qrSrc, setQrSrc] = useState("");

	useEffect(() => {
		let active = true;
		void QRCode.toDataURL(url, {
			margin: 1,
			width: 220,
			color: {
				dark: "#f8fafc",
				light: "#00000000",
			},
		}).then((src) => {
			if (active) {
				setQrSrc(src);
			}
		});
		return () => {
			active = false;
		};
	}, [url]);

	return (
		<section className="club-panel rounded-lg p-5">
			<div className="mb-4 flex items-center gap-2 text-white">
				<LinkIcon className="h-5 w-5 text-cyan-300" />
				<h2 className="club-title text-xl font-bold">{label}</h2>
			</div>
			<div className="mb-4 flex aspect-square w-full max-w-[220px] items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
				{qrSrc ? (
					<img src={qrSrc} alt="QR code for game link" className="h-full w-full" />
				) : (
					<span className="text-sm text-slate-400">Generating QR...</span>
				)}
			</div>
			<div className="rounded-md border border-dashed border-cyan-300/40 bg-cyan-300/10 p-4 text-sm text-cyan-50">
				{url}
			</div>
			<button
				type="button"
				onClick={() => void navigator.clipboard.writeText(url)}
				className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
			>
				<Copy className="h-4 w-4" />
				Copy link
			</button>
		</section>
	);
}
```

- [ ] **Step 3: Add participant list**

Create `src/components/games/ParticipantList.tsx`:

```tsx
type Participant = {
	_id: string;
	displayName: string;
	role: "host" | "player" | "watcher";
	seat?: string;
	connected: boolean;
};

export function ParticipantList({ participants }: { participants: Participant[] }) {
	return (
		<div className="club-panel rounded-lg p-4">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
				Players
			</h2>
			<ul className="space-y-2">
				{participants.map((participant) => (
					<li
						key={participant._id}
						className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm"
					>
						<span className="font-semibold text-white">{participant.displayName}</span>
						<span className="text-slate-400">
							{participant.seat ?? participant.role}
							{participant.connected ? "" : " away"}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
```

- [ ] **Step 4: Add session shell**

Create `src/components/games/SessionShell.tsx`:

```tsx
export function SessionShell({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<main className="club-wrap grid gap-5 py-6 lg:grid-cols-[1fr_320px]">
			<section>
				<h1 className="club-title mb-5 text-3xl font-bold text-white">{title}</h1>
				{children}
			</section>
			{aside ? <aside className="space-y-4">{aside}</aside> : null}
		</main>
	);
}
```

- [ ] **Step 5: Add seat banner**

Create `src/components/games/SeatBanner.tsx`:

```tsx
export function SeatBanner({
	label,
	tone = "neutral",
}: {
	label: string;
	tone?: "neutral" | "success" | "warning";
}) {
	const className =
		tone === "success"
			? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
			: tone === "warning"
				? "border-orange-300/30 bg-orange-300/10 text-orange-100"
				: "border-white/10 bg-white/5 text-slate-200";

	return <div className={`rounded-md border px-3 py-2 text-sm ${className}`}>{label}</div>;
}
```

- [ ] **Step 6: Add join route**

Create `src/routes/join.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { getOrCreateGuestIdentity, normalizeJoinCode } from "#/lib/games/sessions";

export const Route = createFileRoute("/join")({
	validateSearch: (search) => ({
		code: typeof search.code === "string" ? search.code : "",
		token: typeof search.token === "string" ? search.token : "",
	}),
	component: JoinPage,
});

function JoinPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const joinByCode = useMutation(api.sessions.joinByCode);
	const [code, setCode] = useState(search.code);
	const [name, setName] = useState("");
	const [error, setError] = useState("");

	return (
		<main className="club-wrap flex min-h-[70vh] items-center justify-center py-10">
			<form
				className="club-panel w-full max-w-md rounded-lg p-6"
				onSubmit={async (event) => {
					event.preventDefault();
					setError("");
					const guest = getOrCreateGuestIdentity();
					try {
						const result = await joinByCode({
							joinCode: normalizeJoinCode(code),
							displayName: name || guest.displayName,
							guestId: guest.id,
						});
						if (result.gameType === "live-quiz") {
							await navigate({ to: "/quiz/$sessionId/play", params: { sessionId: result.sessionId } });
						}
					} catch (caught) {
						setError(caught instanceof Error ? caught.message : "Could not join game");
					}
				}}
			>
				<p className="club-kicker mb-2">Join game</p>
				<h1 className="club-title mb-5 text-3xl font-bold text-white">Enter your code</h1>
				<label className="mb-2 block text-sm font-bold text-slate-200" htmlFor="join-name">
					Display name
				</label>
				<input
					id="join-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					className="mb-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
					placeholder="Player name"
				/>
				<label className="mb-2 block text-sm font-bold text-slate-200" htmlFor="join-code">
					Room code
				</label>
				<input
					id="join-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					className="mb-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
					placeholder="ABC123"
				/>
				{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
				<button className="w-full rounded-md bg-cyan-300 px-4 py-2.5 font-bold text-slate-950">
					Join
				</button>
			</form>
		</main>
	);
}
```

- [ ] **Step 7: Run check/build and commit**

Run:

```bash
npm run check
npm run build
git add package.json package-lock.json src/components/games src/routes/join.tsx src/routeTree.gen.ts
git commit -m "feat: add session join UI"
```

Expected: check and build pass before committing.

---

### Task 8: Add Live Quiz Convex Functions

**Files:**
- Create: `convex/quiz.ts`

- [ ] **Step 1: Add quiz functions**

Create `convex/quiz.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { quizQuestionValidator } from "./schema";

const SAMPLE_QUESTIONS = [
	{
		id: "q1",
		prompt: "Which planet is known as the Red Planet?",
		choices: [
			{ id: "a", label: "Mars" },
			{ id: "b", label: "Venus" },
			{ id: "c", label: "Jupiter" },
			{ id: "d", label: "Mercury" },
		],
		correctChoiceIds: ["a"],
		durationSeconds: 20,
		points: 1000,
	},
	{
		id: "q2",
		prompt: "What does CSS stand for?",
		choices: [
			{ id: "a", label: "Computer Style Sheets" },
			{ id: "b", label: "Cascading Style Sheets" },
			{ id: "c", label: "Creative Screen Syntax" },
			{ id: "d", label: "Color Script System" },
		],
		correctChoiceIds: ["b"],
		durationSeconds: 20,
		points: 1000,
	},
];

export const ensureSampleSet = mutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db
			.query("quizSets")
			.filter((q) => q.eq(q.field("isSample"), true))
			.first();
		if (existing) {
			return existing._id;
		}
		return await ctx.db.insert("quizSets", {
			title: "Starter Quiz",
			description: "A tiny sample quiz for testing the live room flow.",
			questions: SAMPLE_QUESTIONS,
			isSample: true,
		});
	},
});

export const listSampleSets = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("quizSets")
			.filter((q) => q.eq(q.field("isSample"), true))
			.collect();
	},
});

export const startForSession = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		quizSetId: v.id("quizSets"),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "live-quiz") {
			throw new Error("Live quiz session not found");
		}
		const existing = await ctx.db
			.query("liveQuizStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, {
				quizSetId: args.quizSetId,
				phase: "lobby",
				currentQuestionIndex: 0,
				showCorrectAnswer: false,
			});
			return existing._id;
		}
		return await ctx.db.insert("liveQuizStates", {
			sessionId: args.sessionId,
			quizSetId: args.quizSetId,
			phase: "lobby",
			currentQuestionIndex: 0,
			showCorrectAnswer: false,
		});
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const quizState = await ctx.db
			.query("liveQuizStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		const quizSet = quizState?.quizSetId ? await ctx.db.get(quizState.quizSetId) : null;
		const answers = await ctx.db
			.query("liveQuizAnswers")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		return { session, participants, quizState, quizSet, answers };
	},
});
```

- [ ] **Step 2: Run Convex typecheck**

Run:

```bash
npx convex dev --once
```

Expected: pass and generated API includes `quiz`.

- [ ] **Step 3: Commit quiz backend**

Run:

```bash
git add convex/quiz.ts convex/_generated
git commit -m "feat: add live quiz backend"
```

---

### Task 9: Add Live Quiz Routes And Components

**Files:**
- Create: `src/routes/quiz/new.tsx`
- Create: `src/routes/quiz/$sessionId/host.tsx`
- Create: `src/routes/quiz/$sessionId/play.tsx`
- Create: `src/components/quiz/QuizSetupForm.tsx`
- Create: `src/components/quiz/QuizHostView.tsx`
- Create: `src/components/quiz/QuizPlayerView.tsx`
- Create: `src/components/quiz/Scoreboard.tsx`

- [ ] **Step 1: Add quiz setup form**

Create `src/components/quiz/QuizSetupForm.tsx`:

```tsx
import { useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";

export function QuizSetupForm() {
	const navigate = useNavigate();
	const createSession = useMutation(api.sessions.create);

	return (
		<button
			type="button"
			className="rounded-md bg-cyan-300 px-5 py-3 font-bold text-slate-950"
			onClick={async () => {
				const guest = getOrCreateGuestIdentity();
				const result = await createSession({
					gameType: "live-quiz",
					joinMode: "room",
					authPolicy: "hostChoice",
					title: "Live Quiz",
					displayName: guest.displayName,
					guestId: guest.id,
				});
				await navigate({
					to: "/quiz/$sessionId/host",
					params: { sessionId: result.sessionId },
				});
			}}
		>
			Create quiz room
		</button>
	);
}
```

- [ ] **Step 2: Add quiz new route**

Create `src/routes/quiz/new.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { QuizSetupForm } from "#/components/quiz/QuizSetupForm";

export const Route = createFileRoute("/quiz/new")({ component: QuizNewPage });

function QuizNewPage() {
	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">Live Quiz</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">Host a quiz room</h1>
			<p className="mb-6 max-w-2xl text-slate-300">
				Create a room, show the join code, and let players answer from their own devices.
			</p>
			<QuizSetupForm />
		</main>
	);
}
```

- [ ] **Step 3: Add host view**

Create `src/components/quiz/QuizHostView.tsx`:

```tsx
import { formatJoinCode } from "#/lib/games/sessions";
import { ParticipantList } from "#/components/games/ParticipantList";

type QuizBundle = {
	session: { title: string; joinCode?: string };
	participants: Array<{
		_id: string;
		displayName: string;
		role: "host" | "player" | "watcher";
		seat?: string;
		connected: boolean;
	}>;
};

export function QuizHostView({ bundle }: { bundle: QuizBundle }) {
	return (
		<div className="grid gap-5 lg:grid-cols-[1fr_300px]">
			<section className="club-panel rounded-lg p-8 text-center">
				<p className="club-kicker mb-3">Join code</p>
				<div className="club-title text-7xl font-bold text-white">
					{bundle.session.joinCode ? formatJoinCode(bundle.session.joinCode) : "------"}
				</div>
				<p className="mt-5 text-slate-300">
					Players can join from the home screen or `/join`.
				</p>
			</section>
			<ParticipantList participants={bundle.participants} />
		</div>
	);
}
```

- [ ] **Step 4: Add host route**

Create `src/routes/quiz/$sessionId/host.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { QuizHostView } from "#/components/quiz/QuizHostView";

export const Route = createFileRoute("/quiz/$sessionId/host")({
	component: QuizHostPage,
});

function QuizHostPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.quiz.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return <main className="club-wrap py-10 text-slate-300">Loading quiz...</main>;
	}
	if (bundle === null) {
		return <main className="club-wrap py-10 text-orange-200">Quiz not found.</main>;
	}
	return (
		<main className="club-wrap py-6">
			<QuizHostView bundle={bundle} />
		</main>
	);
}
```

- [ ] **Step 5: Add player view and route**

Create `src/components/quiz/QuizPlayerView.tsx`:

```tsx
export function QuizPlayerView() {
	return (
		<section className="club-panel rounded-lg p-6 text-center">
			<p className="club-kicker mb-3">You are in</p>
			<h1 className="club-title text-3xl font-bold text-white">Waiting for the host</h1>
			<p className="mt-3 text-slate-300">The first question will appear here.</p>
		</section>
	);
}
```

Create `src/routes/quiz/$sessionId/play.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { QuizPlayerView } from "#/components/quiz/QuizPlayerView";

export const Route = createFileRoute("/quiz/$sessionId/play")({
	component: QuizPlayerPage,
});

function QuizPlayerPage() {
	return (
		<main className="club-wrap flex min-h-[70vh] items-center justify-center py-10">
			<QuizPlayerView />
		</main>
	);
}
```

- [ ] **Step 6: Run route generation, check, build, and commit**

Run:

```bash
npm run generate-routes
npm run check
npm run build
git add src/components/quiz src/routes/quiz src/routeTree.gen.ts
git commit -m "feat: add live quiz routes"
```

Expected: check and build pass.

---

### Task 10: Add Backgammon Challenge Flow

**Files:**
- Create: `convex/backgammon.ts`
- Create: `src/routes/backgammon/new.tsx`
- Create: `src/routes/backgammon/$sessionId.tsx`
- Create: `src/components/backgammon/BackgammonWaitingRoom.tsx`

- [ ] **Step 1: Add Backgammon backend helpers**

Create `convex/backgammon.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("backgammonStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			return existing._id;
		}
		return await ctx.db.insert("backgammonStates", {
			sessionId: args.sessionId,
			phase: "waiting",
			whiteParticipantId: args.hostParticipantId,
			moveLog: ["Challenge created"],
		});
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const state = await ctx.db
			.query("backgammonStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		return { session, participants, state };
	},
});
```

- [ ] **Step 2: Add Backgammon waiting component**

Create `src/components/backgammon/BackgammonWaitingRoom.tsx`:

```tsx
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";

type Bundle = {
	session: { title: string; shareToken?: string };
	participants: Array<{
		_id: string;
		displayName: string;
		role: "host" | "player" | "watcher";
		seat?: string;
		connected: boolean;
	}>;
	state: { phase: "waiting" | "ready" | "active" | "finished" } | null;
};

export function BackgammonWaitingRoom({
	bundle,
	shareUrl,
}: {
	bundle: Bundle;
	shareUrl: string;
}) {
	const opponentJoined = bundle.participants.length > 1;
	return (
		<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
			<section className="club-panel rounded-lg p-6">
				<p className="club-kicker mb-2">Backgammon</p>
				<h1 className="club-title mb-4 text-3xl font-bold text-white">
					{opponentJoined ? "Opponent joined" : "Waiting for opponent"}
				</h1>
				<SeatBanner
					tone={opponentJoined ? "success" : "warning"}
					label={
						opponentJoined
							? "Both seats are claimed. Playable board rules come in the Backgammon rules plan."
							: "Share the link with one opponent to claim the second seat."
					}
				/>
				<div className="mt-6 aspect-[1.25] rounded-lg border border-white/10 bg-[linear-gradient(135deg,#1f2937,#111827)] p-4">
					<div className="grid h-full grid-cols-2 gap-3">
						<div className="rounded-md bg-orange-300/20" />
						<div className="rounded-md bg-cyan-300/20" />
					</div>
				</div>
			</section>
			<aside className="space-y-4">
				<QrSharePanel label="Challenge link" url={shareUrl} />
				<ParticipantList participants={bundle.participants} />
			</aside>
		</div>
	);
}
```

- [ ] **Step 3: Add Backgammon new route**

Create `src/routes/backgammon/new.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";

export const Route = createFileRoute("/backgammon/new")({
	component: BackgammonNewPage,
});

function BackgammonNewPage() {
	const navigate = useNavigate();
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.backgammon.createState);

	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">Backgammon</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Start a challenge
			</h1>
			<button
				type="button"
				className="rounded-md bg-white px-5 py-3 font-bold text-slate-950"
				onClick={async () => {
					const guest = getOrCreateGuestIdentity();
					const result = await createSession({
						gameType: "backgammon",
						joinMode: "challenge",
						authPolicy: "guestAllowed",
						title: "Backgammon Match",
						displayName: guest.displayName,
						guestId: guest.id,
					});
					await createState({
						sessionId: result.sessionId,
						hostParticipantId: result.participantId,
					});
					await navigate({
						to: "/backgammon/$sessionId",
						params: { sessionId: result.sessionId },
					});
				}}
			>
				Create challenge link
			</button>
		</main>
	);
}
```

- [ ] **Step 4: Add Backgammon session route**

Create `src/routes/backgammon/$sessionId.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackgammonWaitingRoom } from "#/components/backgammon/BackgammonWaitingRoom";
import { buildShareUrl } from "#/lib/games/sessions";

export const Route = createFileRoute("/backgammon/$sessionId")({
	component: BackgammonSessionPage,
});

function BackgammonSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.backgammon.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return <main className="club-wrap py-10 text-slate-300">Loading match...</main>;
	}
	if (bundle === null) {
		return <main className="club-wrap py-10 text-orange-200">Match not found.</main>;
	}

	const shareUrl = bundle.session.shareToken
		? buildShareUrl(window.location.origin, bundle.session.shareToken)
		: window.location.href;

	return (
		<main className="club-wrap py-6">
			<BackgammonWaitingRoom bundle={bundle} shareUrl={shareUrl} />
		</main>
	);
}
```

- [ ] **Step 5: Run Convex typecheck, route generation, check, build, and commit**

Run:

```bash
npx convex dev --once
npm run generate-routes
npm run check
npm run build
git add convex/backgammon.ts convex/_generated src/components/backgammon src/routes/backgammon src/routeTree.gen.ts
git commit -m "feat: add backgammon challenge flow"
```

Expected: all commands pass.

---

### Task 11: Add Dashboard And Future Game Detail Pages

**Files:**
- Create: `src/routes/dashboard/index.tsx`
- Create: `src/routes/games/$gameType.tsx`

- [ ] **Step 1: Add dashboard route**

Create `src/routes/dashboard/index.tsx`:

```tsx
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({ component: DashboardPage });

function DashboardPage() {
	return (
		<>
			<SignedIn>
				<main className="club-wrap py-10">
					<p className="club-kicker mb-2">Dashboard</p>
					<h1 className="club-title mb-6 text-4xl font-bold text-white">
						Your game table
					</h1>
					<div className="grid gap-4 md:grid-cols-2">
						<Link
							to="/quiz/new"
							className="club-panel rounded-lg p-5 text-white no-underline"
						>
							<h2 className="club-title text-xl font-bold">Host a quiz</h2>
							<p className="mt-2 text-slate-300">Create a live room.</p>
						</Link>
						<Link
							to="/backgammon/new"
							className="club-panel rounded-lg p-5 text-white no-underline"
						>
							<h2 className="club-title text-xl font-bold">Start backgammon</h2>
							<p className="mt-2 text-slate-300">Share a direct challenge.</p>
						</Link>
					</div>
				</main>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}
```

- [ ] **Step 2: Add future game route**

Create `src/routes/games/$gameType.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { getGameByType, type GameType } from "#/lib/games/catalog";

export const Route = createFileRoute("/games/$gameType")({
	component: GameDetailPage,
});

function GameDetailPage() {
	const { gameType } = Route.useParams();
	const game = getGameByType(gameType as GameType);

	if (!game) {
		return <main className="club-wrap py-10 text-orange-200">Game not found.</main>;
	}

	const Icon = game.icon;
	return (
		<main className="club-wrap py-10">
			<section className="club-panel max-w-3xl rounded-lg p-6">
				<div
					className={`mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br ${game.accent} text-slate-950`}
				>
					<Icon className="h-7 w-7" />
				</div>
				<p className="club-kicker mb-2">{game.tagline}</p>
				<h1 className="club-title mb-4 text-4xl font-bold text-white">{game.title}</h1>
				<p className="text-lg leading-8 text-slate-300">{game.description}</p>
				<p className="mt-5 rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
					This game is on the Arcade Club shelf and will use the same session system when it becomes playable.
				</p>
				<Link
					to="/"
					className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950 no-underline"
				>
					Back to games
				</Link>
			</section>
		</main>
	);
}
```

- [ ] **Step 3: Run check/build and commit**

Run:

```bash
npm run generate-routes
npm run check
npm run build
git add src/routes/dashboard src/routes/games src/routeTree.gen.ts
git commit -m "feat: add dashboard and game detail pages"
```

Expected: check and build pass.

---

### Task 12: Cleanup Demo Scaffold And Documentation

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Delete or leave unlinked: `src/routes/demo/*`, `src/components/demo-*`, `src/lib/demo-*`, `src/data/demo-guitars.ts`, `src/hooks/demo-*`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: Remove demo navigation from header**

Modify `src/components/Header.tsx` so visible navigation contains only:

```tsx
<Link to="/">Games</Link>
<Link to="/join">Join</Link>
<Link to="/dashboard">Dashboard</Link>
```

Keep `ClerkHeader` and `ThemeToggle` if they still fit the design. Remove `TanChatAIAssistant` from the header for this first slice.

- [ ] **Step 2: Delete demo-only files**

Delete these files after verifying no non-demo imports depend on them:

```text
src/hooks/demo-useTTS.ts
src/hooks/demo-useAudioRecorder.ts
src/lib/demo-ai-hook.ts
src/lib/demo-guitar-tools.ts
src/lib/demo-store.ts
src/lib/demo-store-devtools.tsx
src/components/demo-GuitarRecommendation.tsx
src/components/demo-AIAssistant.tsx
src/data/demo-guitars.ts
src/routes/demo/
```

Also remove `StoreDevtools` from `src/routes/__root.tsx`.

- [ ] **Step 3: Update README**

Replace README content with:

```md
# Arcade Club

Arcade Club is a real-time games web app built with TanStack Start, Clerk, and Convex.

## Features

- Live Quiz rooms with host screen, join code, and player devices.
- Backgammon challenge links for direct two-player games.
- Game catalog with future games including Sudoku, Chess, Hitster, and Word Games.
- Guest-friendly joining with signed-in ownership for saved sessions.

## Tech Stack

- React 19 + TanStack Start
- Convex real-time backend
- Clerk authentication
- Tailwind CSS v4
- Biome and Vitest
- Cloudflare Workers deployment

## Development

Run Convex and Vite in separate terminals:

```bash
npx convex dev
npm run dev
```

## Verification

```bash
npm run check
npm run test
npm run build
```
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run generate-routes
npm run check
npm run test
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit cleanup**

Run:

```bash
git add README.md package.json src convex src/routeTree.gen.ts
git add -u
git commit -m "chore: remove starter demo scaffold"
```

---

## Final Verification

- [ ] Run `git status --short` and verify only intended files are changed or untracked.
- [ ] Run `npm run check`; expected pass.
- [ ] Run `npm run test`; expected pass.
- [ ] Run `npm run build`; expected pass.
- [ ] Start the app with `npm run dev` and `npx convex dev` in separate terminals.
- [ ] Use the browser to verify:
  - `/` shows Arcade Club catalog.
  - Join panel routes to `/join`.
  - `/quiz/new` creates a room and routes to host screen.
  - Host screen shows a join code.
  - `/join?code=<code>` lets a second browser/device join.
  - `/backgammon/new` creates a challenge.
  - `/backgammon/$sessionId` shows a share link and waiting screen.
  - Future game cards open `/games/$gameType`.

## Plan Self-Review

Spec coverage:

- Arcade Club catalog: Task 1 and Task 6.
- Reusable session foundation: Task 2, Task 4, Task 5, and Task 7.
- Live Quiz MVP: Task 3, Task 8, and Task 9.
- Backgammon challenge flow: Task 10.
- Future game cards: Task 1 and Task 11.
- Cleanup from scaffold: Task 12.

Intentional gap:

- Full playable Backgammon rules are excluded from this plan and need a separate rules-engine plan.

Red-flag scan:

- Future games are represented as non-playable catalog items with concrete routes and display behavior. The plan has no unresolved requirement markers.

Type consistency:

- `GameType`, `JoinMode`, `AuthPolicy`, `SessionStatus`, `ParticipantRole`, and `QuizPhase` names match between planned frontend helpers and Convex schema validators.

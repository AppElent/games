/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { expectCode, guestIdOf, seatSecretOf } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const SECRET_A = seatSecretOf("a");
const SECRET_B = seatSecretOf("b");

function setup() {
	return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

function tableArgs(overrides: Record<string, unknown> = {}) {
	return {
		seatSecret: SECRET_A,
		joinMode: "solo" as const,
		title: "Table",
		displayName: "Me",
		guestId: guestIdOf("me"),
		gameId: "pesten",
		options: [] as string[],
		bots: 2,
		start: true,
		...overrides,
	};
}

async function soloTable(t: T, gameId = "pesten", bots = 2) {
	return await t.mutation(
		api.cardGames.createTable,
		tableArgs({ gameId, bots }),
	);
}

async function roomTable(
	t: T,
	options: string[] = [],
	guestSecret: string | null = SECRET_B,
) {
	const host = t.withIdentity({ subject: "user_host" });
	const { sessionId, participantId, joinCode } = await host.mutation(
		api.cardGames.createTable,
		tableArgs({
			joinMode: "room",
			displayName: "Host",
			guestId: undefined,
			options,
			bots: 0,
			start: false,
		}),
	);
	const guest = await t.mutation(api.sessions.joinByCode, {
		joinCode: joinCode as string,
		displayName: "Guest",
		guestId: guestIdOf("two"),
		seatSecret: guestSecret ?? undefined,
	});
	return {
		host,
		sessionId,
		participantId,
		joinCode: joinCode as string,
		guestId: guest.participantId,
	};
}

async function read(
	t: T,
	args: {
		sessionId: Id<"gameSessions">;
		participantId?: Id<"sessionParticipants">;
		seatSecret?: string;
	},
) {
	const table = await t.query(api.cardGames.getTable, args);
	if (!table) {
		throw new Error("table not found");
	}
	return table as Omit<typeof table, "view"> & {
		view: {
			hand: string[];
			turn: number;
			phase: string;
			canPass?: boolean;
			events: unknown[];
			family?: string;
			handCounts?: number[];
			totals?: number[];
		};
	};
}

const creds = (
	sessionId: Id<"gameSessions">,
	participantId: Id<"sessionParticipants">,
	seatSecret = SECRET_A,
) => ({ sessionId, participantId, seatSecret });

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("creating a table", () => {
	it("lets a guest start a solo game against the computer", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		const table = await read(t, creds(sessionId, participantId));
		expect(table.status).toBe("playing");
		expect(table.seats).toHaveLength(3);
		expect(table.view.hand).toHaveLength(7);
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("active");
	});

	it("rejects unknown games, unknown house rules and too many bots", async () => {
		const t = setup();
		for (const overrides of [
			{ gameId: "poker" },
			{ options: ["nope"] },
			{ bots: 99 },
			{ seatSecret: "short" },
			// Long enough for the old length check, but not the shape clients make.
			{ seatSecret: "secret-a-0123456789" },
			{ seatSecret: "x".repeat(72) },
		]) {
			await expect(
				t.mutation(api.cardGames.createTable, tableArgs(overrides)),
			).rejects.toThrow();
		}
		const sessions = await t.run((ctx) =>
			ctx.db.query("gameSessions").collect(),
		);
		expect(sessions).toHaveLength(0);
	});

	it("needs an account to open a room", async () => {
		const t = setup();
		await expect(
			t.mutation(api.cardGames.createTable, tableArgs({ joinMode: "room" })),
		).rejects.toThrow();
	});

	it("never leaves a session without its table for someone else to claim", async () => {
		const t = setup();
		await expect(
			t.mutation(api.sessions.create, {
				gameType: "card-games",
				joinMode: "solo",
				authPolicy: "guestAllowed",
				title: "Table",
				displayName: "Me",
				guestId: guestIdOf("me"),
			}),
		).rejects.toThrow();
	});
});

describe("privacy", () => {
	it("never returns other hands, secrets, or guest ids", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		const stored = await t.run((ctx) =>
			ctx.db.query("cardGameStates").unique(),
		);
		const game = stored?.game as { hands: string[][]; stock: string[] };
		const mine = JSON.stringify(await read(t, creds(sessionId, participantId)));
		for (const card of [...game.hands[1], ...game.stock]) {
			expect(mine).not.toContain(`"${card}"`);
		}
		expect(mine).not.toContain(SECRET_A);
		expect(mine).not.toContain(guestIdOf("me"));
	});

	it("treats a public participant id without the secret as a spectator", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		const spoof = await read(
			t,
			creds(sessionId, participantId, seatSecretOf("wrong")),
		);
		expect(spoof.you).toBeNull();
		expect(spoof.view.hand).toEqual([]);
		const anonymous = await read(t, { sessionId });
		expect(anonymous.you).toBeNull();
		expect(anonymous.view.hand).toEqual([]);
	});

	it("rejects moves made with someone's public id", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		await expect(
			t.mutation(api.cardGames.act, {
				...creds(sessionId, participantId, seatSecretOf("wrong")),
				action: { type: "draw" },
			}),
		).rejects.toThrow();
	});

	it("will not hand a claimed seat to a new secret without the account", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		await expect(
			t.mutation(
				api.cardGames.takeSeat,
				creds(sessionId, participantId, seatSecretOf("another")),
			),
		).rejects.toThrow();
	});

	it("seats a guest as they join, so nobody can claim them first", async () => {
		const t = setup();
		const { sessionId, guestId } = await roomTable(t);
		const table = await read(t, creds(sessionId, guestId, SECRET_B));
		expect(table.you).toBe(1);
		await expect(
			t.mutation(
				api.cardGames.takeSeat,
				creds(sessionId, guestId, seatSecretOf("attacker")),
			),
		).rejects.toThrow();
		const peek = await read(
			t,
			creds(sessionId, guestId, seatSecretOf("attacker")),
		);
		expect(peek.you).toBeNull();
		expect(
			await read(t, creds(sessionId, guestId, SECRET_B)).then((row) => row.you),
		).toBe(1);
	});

	it("will not seat a guest through their public id alone", async () => {
		const t = setup();
		const { sessionId, guestId } = await roomTable(t, [], null);
		expect(
			await t.mutation(
				api.cardGames.takeSeat,
				creds(sessionId, guestId, seatSecretOf("attacker")),
			),
		).toBeNull();
		const table = await read(t, { sessionId });
		expect(table.seats).toHaveLength(1);
	});

	it("does not seat a spectator or take a short secret on join", async () => {
		const t = setup();
		const { sessionId, joinCode } = await roomTable(t, [], null);
		await t.mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Watcher",
			guestId: guestIdOf("watch"),
			asSpectator: true,
			seatSecret: SECRET_B,
		});
		expect((await read(t, { sessionId })).seats).toHaveLength(1);
		await expect(
			t.mutation(api.sessions.joinByCode, {
				joinCode,
				displayName: "Short",
				guestId: guestIdOf("short"),
				seatSecret: "short",
			}),
		).rejects.toThrow();
	});

	it("lets someone who came to watch sit down by joining again", async () => {
		const t = setup();
		const { sessionId, joinCode } = await roomTable(t, [], null);
		const join = (asSpectator: boolean) =>
			t.mutation(api.sessions.joinByCode, {
				joinCode,
				displayName: "Watcher",
				guestId: guestIdOf("watch"),
				asSpectator,
				seatSecret: SECRET_B,
			});
		const watching = await join(true);
		expect(watching.seatClaimed).toBe(false);
		const seated = await join(false);
		expect(seated.participantId).toBe(watching.participantId);
		expect(seated.seatClaimed).toBe(true);
		expect(
			(await read(t, creds(sessionId, seated.participantId, SECRET_B))).you,
		).toBe(1);
		expect((await join(false)).seatClaimed).toBe(false);
	});

	it("lets a signed-in player claim a free seat through their account", async () => {
		const t = setup();
		const { sessionId, joinCode } = await roomTable(t, [], null);
		const member = t.withIdentity({ subject: "user_member" });
		const joined = await member.mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Member",
		});
		await expect(
			t.mutation(
				api.cardGames.takeSeat,
				creds(sessionId, joined.participantId, seatSecretOf("attacker")),
			),
		).resolves.toBeNull();
		await expect(
			member.mutation(
				api.cardGames.takeSeat,
				creds(sessionId, joined.participantId, SECRET_B),
			),
		).resolves.toBe(1);
	});

	it("lets a signed-in player re-claim their seat on another device", async () => {
		const t = setup();
		const { host, sessionId, participantId } = await roomTable(t);
		const seat = await host.mutation(
			api.cardGames.takeSeat,
			creds(sessionId, participantId, SECRET_B),
		);
		expect(seat).toBe(0);
		const table = await read(t, creds(sessionId, participantId, SECRET_B));
		expect(table.you).toBe(0);
	});
});

describe("reclaiming a seat", () => {
	it("gives a signed-in player their seat back on a fresh client, keeping its secret", async () => {
		const t = setup();
		const { host, sessionId, participantId } = await roomTable(t);
		const found = await host.mutation(api.cardGames.reclaimSeat, {
			sessionId,
		});
		expect(found).toEqual({ participantId, seatSecret: SECRET_A });
		if (!found) {
			throw new Error("no seat");
		}
		await host.mutation(api.cardGames.start, { sessionId, ...found });
		const table = await read(t, { sessionId, ...found });
		expect(table.you).toBe(0);
		expect(table.status).toBe("playing");
		// The first device still holds the seat: nothing was re-keyed.
		expect((await read(t, creds(sessionId, participantId))).you).toBe(0);
	});

	it("gives nothing to a guest, another account or a joiner without a seat", async () => {
		const t = setup();
		const { sessionId, joinCode } = await roomTable(t);
		const reclaim = (caller: Pick<T, "mutation">) =>
			caller.mutation(api.cardGames.reclaimSeat, { sessionId });
		await expect(reclaim(t)).resolves.toBeNull();
		await expect(
			reclaim(t.withIdentity({ subject: "user_stranger" })),
		).resolves.toBeNull();
		const watcher = t.withIdentity({ subject: "user_watcher" });
		await watcher.mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Watcher",
		});
		await expect(reclaim(watcher)).resolves.toBeNull();
	});

	it("gives nothing to a player the host removed", async () => {
		const t = setup();
		const { host, sessionId, participantId, joinCode } = await roomTable(t);
		const member = t.withIdentity({ subject: "user_member" });
		const joined = await member.mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Member",
			seatSecret: seatSecretOf("m"),
		});
		expect(joined.seatClaimed).toBe(true);
		await expect(
			member.mutation(api.cardGames.reclaimSeat, { sessionId }),
		).resolves.toMatchObject({ participantId: joined.participantId });
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: participantId,
			targetParticipantId: joined.participantId,
		});
		await expect(
			member.mutation(api.cardGames.reclaimSeat, { sessionId }),
		).resolves.toBeNull();
	});
});

describe("host controls", () => {
	it("takes more than the host's public id to kick a player", async () => {
		const t = setup();
		const { host, sessionId, participantId, guestId } = await roomTable(t);
		const kick = {
			sessionId,
			hostParticipantId: participantId,
			targetParticipantId: guestId,
		};
		await expect(
			t.mutation(api.sessions.kickParticipant, kick),
		).rejects.toThrow();
		const other = t.withIdentity({ subject: "user_other" });
		await expect(
			other.mutation(api.sessions.kickParticipant, kick),
		).rejects.toThrow();
		await host.mutation(api.sessions.kickParticipant, kick);
		const kicked = await t.run((ctx) => ctx.db.get(guestId));
		expect(kicked?.kickedAt).toBeDefined();
	});
});

describe("lobby", () => {
	it("seats joiners, adds bots, and lets only the host start", async () => {
		const t = setup();
		const { sessionId, participantId, guestId } = await roomTable(t);
		expect(
			await t.mutation(
				api.cardGames.takeSeat,
				creds(sessionId, guestId, SECRET_B),
			),
		).toBe(1);
		await t.mutation(api.cardGames.addBot, creds(sessionId, participantId));
		await expect(
			t.mutation(api.cardGames.addBot, creds(sessionId, guestId, SECRET_B)),
		).rejects.toThrow();
		await expect(
			t.mutation(api.cardGames.start, creds(sessionId, guestId, SECRET_B)),
		).rejects.toThrow();
		await t.mutation(api.cardGames.start, creds(sessionId, participantId));
		const table = await read(t, creds(sessionId, guestId, SECRET_B));
		expect(table.status).toBe("playing");
		expect(table.you).toBe(1);
		expect(table.view.hand).toHaveLength(7);
	});

	it("lets any seated player deal the rematch, so a departed host blocks nobody", async () => {
		const t = setup();
		const { sessionId, participantId, guestId } = await roomTable(t);
		await t.mutation(
			api.cardGames.takeSeat,
			creds(sessionId, guestId, SECRET_B),
		);
		await t.mutation(api.cardGames.start, creds(sessionId, participantId));
		await t.run(async (ctx) => {
			const row = await ctx.db
				.query("cardGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
				.unique();
			if (row) {
				await ctx.db.patch(row._id, { status: "finished" });
			}
		});
		await t.mutation(
			api.cardGames.rematch,
			creds(sessionId, guestId, SECRET_B),
		);
		const table = await read(t, creds(sessionId, guestId, SECRET_B));
		expect(table.status).toBe("playing");
		expect(table.view.turn).toBe(1);
	});

	it("needs enough players, and a joiner after the deal only watches", async () => {
		const t = setup();
		const { sessionId, participantId, joinCode } = await roomTable(t, [], null);
		await expect(
			t.mutation(api.cardGames.start, creds(sessionId, participantId)),
		).rejects.toThrow();
		await t.mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Second",
			guestId: guestIdOf("three"),
			seatSecret: SECRET_B,
		});
		await t.mutation(api.cardGames.start, creds(sessionId, participantId));
		const late = await t.run((ctx) =>
			ctx.db.insert("sessionParticipants", {
				sessionId,
				displayName: "Late",
				role: "player",
				connected: true,
				lastSeen: 0,
			}),
		);
		expect(
			await t.mutation(
				api.cardGames.takeSeat,
				creds(sessionId, late, seatSecretOf("late")),
			),
		).toBeNull();
	});

	it("removes seats, but not the host's", async () => {
		const t = setup();
		const { sessionId, participantId, guestId } = await roomTable(t);
		await t.mutation(
			api.cardGames.takeSeat,
			creds(sessionId, guestId, SECRET_B),
		);
		await expect(
			t.mutation(api.cardGames.removeSeat, {
				...creds(sessionId, participantId),
				seat: 0,
			}),
		).rejects.toThrow();
		await t.mutation(api.cardGames.removeSeat, {
			...creds(sessionId, participantId),
			seat: 1,
		});
		const table = await read(t, { sessionId });
		expect(table.seats).toHaveLength(1);
		const removed = await t.run((ctx) => ctx.db.get(guestId));
		expect(removed?.kickedAt).toBeDefined();
	});
});

describe("play", () => {
	it("rejects illegal moves on the server", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		await expect(
			t.mutation(api.cardGames.act, {
				...creds(sessionId, participantId),
				action: { type: "play", card: "not-my-card" },
			}),
		).rejects.toThrow();
		await expect(
			t.mutation(api.cardGames.act, {
				...creds(sessionId, participantId),
				action: { type: "drawStock" },
			}),
		).rejects.toThrow();
	});

	it("bots take their turns after a human's move", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		await t.mutation(api.cardGames.act, {
			...creds(sessionId, participantId),
			action: { type: "draw" },
		});
		const first = await read(t, creds(sessionId, participantId));
		if (first.view.canPass) {
			await t.mutation(api.cardGames.act, {
				...creds(sessionId, participantId),
				action: { type: "pass" },
			});
		}
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const after = await read(t, creds(sessionId, participantId));
		expect(after.view.phase === "finished" || after.view.turn === 0).toBe(true);
		expect(after.view.events.length).toBeGreaterThan(2);
	});

	it("a stale bot job does nothing", async () => {
		const t = setup();
		const { sessionId } = await soloTable(t);
		const table = await t.run((ctx) => ctx.db.query("cardGameStates").unique());
		await t.mutation(internal.cardGames.botStep, {
			tableId: table?._id as Id<"cardGameStates">,
			version: 999,
		});
		const after = await read(t, { sessionId });
		expect(after.view.events).toHaveLength(table?.game.events.length);
	});

	it("a table on autopilot plays a full game to completion and rematches", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t, "jokeren", 1);
		await t.mutation(api.cardGames.setAutopilot, {
			...creds(sessionId, participantId),
			seat: 0,
			on: true,
		});
		// A whole match can take thousands of bot moves; the helper stops at 100 unless told.
		await (
			t.finishAllScheduledFunctions as (
				advance: () => void,
				maxIterations: number,
			) => Promise<void>
		)(vi.runAllTimers, 10_000);
		const done = await read(t, creds(sessionId, participantId));
		expect(done.status).toBe("finished");
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
		await t.mutation(api.cardGames.setAutopilot, {
			...creds(sessionId, participantId),
			seat: 0,
			on: false,
		});
		await t.mutation(api.cardGames.rematch, creds(sessionId, participantId));
		const again = await read(t, creds(sessionId, participantId));
		expect(again.status).toBe("playing");
		const reopened = await t.run((ctx) => ctx.db.get(sessionId));
		expect(reopened?.status).toBe("active");
	});
});

describe("eenentwintigen", () => {
	type BankRead = {
		phase: string;
		hands: string[][];
		bank: (string | null)[];
		stakes: (number | null)[];
		canStake: boolean;
		round: number;
	};
	const bankView = (table: { view: unknown }) => table.view as BankRead;

	it("plays a solo table against the bank, keeping the hole card hidden", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(
			t,
			"eenentwintigen",
			2,
		);
		const opening = bankView(await read(t, creds(sessionId, participantId)));
		expect(opening).toMatchObject({ phase: "stake", canStake: true, round: 1 });
		await expect(
			t.mutation(api.cardGames.act, {
				...creds(sessionId, participantId),
				action: { type: "hit" },
			}),
		).rejects.toMatchObject({ data: { code: "cardsWaitForStakes" } });
		await expect(
			t.mutation(api.cardGames.act, {
				...creds(sessionId, participantId),
				action: { type: "stake", amount: 3 },
			}),
		).rejects.toMatchObject({ data: { code: "cardsBadStake" } });
		await t.mutation(api.cardGames.act, {
			...creds(sessionId, participantId),
			action: { type: "stake", amount: 2 },
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const dealt = bankView(await read(t, creds(sessionId, participantId)));
		// Dealt; a natural would already have settled the round.
		expect(dealt.hands[0].length).toBeGreaterThanOrEqual(2);
		expect(dealt.stakes[0] === 2 || dealt.round === 2).toBe(true);
		// Pin the round mid-play, so the face-down card is certain to be hidden.
		const stored = await t.run((ctx) =>
			ctx.db.query("cardGameStates").unique(),
		);
		if (!stored) throw new Error("no table");
		const game = stored.game as {
			bank: string[];
			stock: string[];
			done: boolean[];
		};
		// The face-down card comes from the stock, which no view or event has shown.
		const hole = game.stock[0];
		await t.run((ctx) =>
			ctx.db.patch(stored._id, {
				game: {
					...stored.game,
					phase: "play",
					turn: 0,
					bank: [game.bank[0], hole],
					stock: game.stock.slice(1),
					bankRevealed: false,
					done: game.done.map(() => false),
				} as typeof stored.game,
			}),
		);
		const playing = await read(t, creds(sessionId, participantId));
		expect(bankView(playing).bank).toEqual([game.bank[0], null]);
		expect(JSON.stringify(playing)).not.toContain(`"${hole}"`);
	});

	it("plays alone against the bank", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(
			t,
			"eenentwintigen",
			0,
		);
		await t.mutation(api.cardGames.act, {
			...creds(sessionId, participantId),
			action: { type: "stake", amount: 5 },
		});
		const dealt = bankView(await read(t, creds(sessionId, participantId)));
		// A natural settles at once; otherwise it is this player's turn.
		expect(
			(dealt.phase === "play" && dealt.hands[0].length === 2) ||
				(dealt.phase === "stake" && dealt.round === 2),
		).toBe(true);
	});

	it("a table on autopilot plays a whole match to the end", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(
			t,
			"eenentwintigen",
			3,
		);
		await t.mutation(api.cardGames.setAutopilot, {
			...creds(sessionId, participantId),
			seat: 0,
			on: true,
		});
		await (
			t.finishAllScheduledFunctions as (
				advance: () => void,
				maxIterations: number,
			) => Promise<void>
		)(vi.runAllTimers, 10_000);
		const done = await read(t, creds(sessionId, participantId));
		expect(done.status).toBe("finished");
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
	});
});

describe("hartenjagen", () => {
	type HeartsView = {
		hand: string[];
		phase: string;
		passed: string[] | null;
		received: string[];
		passReady: boolean[];
		turn: number;
	};

	it("passes, plays and finishes a solo table against three computers", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t, "hartenjagen", 3);
		const me = creds(sessionId, participantId);
		const start = (await read(t, me)).view as unknown as HeartsView;
		expect(start.phase).toBe("passing");
		expect(start.hand).toHaveLength(13);

		const stored = await t.run((ctx) =>
			ctx.db.query("cardGameStates").unique(),
		);
		if (!stored) throw new Error("the table has no state");
		const others = (stored.game as { hands: string[][] }).hands.slice(1).flat();
		const mine = JSON.stringify(await read(t, me));
		for (const card of others) {
			expect(mine).not.toContain(`"${card}"`);
		}

		await expectCode(
			t.mutation(api.cardGames.act, {
				...me,
				action: { type: "play", card: start.hand[0] },
			}),
			"cardsPassFirst",
		);
		await expectCode(
			t.mutation(api.cardGames.act, {
				...me,
				action: { type: "passCards", cards: start.hand.slice(0, 2) },
			}),
			"cardsPassCount",
			{ count: 3 },
		);
		await t.mutation(api.cardGames.act, {
			...me,
			action: { type: "passCards", cards: start.hand.slice(0, 3) },
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const table = await read(t, me);
		const passed = table.view as unknown as HeartsView;
		expect(passed.phase).toBe("playing");
		expect(passed.received).toHaveLength(3);
		// The computers play until it's this seat's turn, so its hand is still whole.
		expect(passed.turn).toBe(table.you);
		expect(passed.hand).toHaveLength(13);

		await t.mutation(api.cardGames.setAutopilot, { ...me, seat: 0, on: true });
		await (
			t.finishAllScheduledFunctions as (
				advance: () => void,
				maxIterations: number,
			) => Promise<void>
		)(vi.runAllTimers, 10_000);
		const done = await read(t, me);
		expect(done.status).toBe("finished");
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
	});

	it("needs at least three players", async () => {
		const t = setup();
		await expect(soloTable(t, "hartenjagen", 1)).rejects.toThrow();
	});
});
describe("klaverjassen", () => {
	type KlaverView = {
		hand: string[];
		phase: string;
		turn: number;
		offered: string | null;
		trump: string | null;
		maker: number | null;
		teams: number[];
		legal: string[];
	};

	it("calls trump, refuses illegal cards and finishes a solo table against three computers", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t, "klaverjassen", 3);
		const me = creds(sessionId, participantId);
		const start = (await read(t, me)).view as unknown as KlaverView;
		// The host sits left of the dealer, so it calls first.
		expect(start).toMatchObject({ phase: "trump", turn: 0, trump: null });
		expect(start.teams).toEqual([0, 1, 0, 1]);
		expect(start.hand).toHaveLength(8);
		expect(start.offered).toMatch(/^[SHDC]$/);

		const stored = await t.run((ctx) =>
			ctx.db.query("cardGameStates").unique(),
		);
		if (!stored) throw new Error("the table has no state");
		const others = (stored.game as { hands: string[][] }).hands.slice(1).flat();
		const mine = JSON.stringify(await read(t, me));
		for (const card of others) {
			expect(mine).not.toContain(`"${card}"`);
		}

		await expectCode(
			t.mutation(api.cardGames.act, {
				...me,
				action: { type: "play", card: start.hand[0] },
			}),
			"cardsCallTrumpFirst",
		);
		const other = (["S", "H", "D", "C"] as const).find(
			(suit) => suit !== start.offered,
		);
		await expectCode(
			t.mutation(api.cardGames.act, {
				...me,
				action: { type: "chooseTrump", suit: other ?? "S" },
			}),
			"cardsTrumpNotOffered",
		);
		await t.mutation(api.cardGames.act, {
			...me,
			action: {
				type: "chooseTrump",
				suit: start.offered as "S" | "H" | "D" | "C",
			},
		});
		const playing = (await read(t, me)).view as unknown as KlaverView;
		expect(playing).toMatchObject({
			phase: "playing",
			trump: start.offered,
			maker: 0,
			turn: 0,
		});

		// A void seat holding a trump must play it.
		await t.run(async (ctx) => {
			const row = await ctx.db.query("cardGameStates").unique();
			if (!row) throw new Error("the table has no state");
			const game = row.game as {
				hands: string[][];
				trick: { seat: number; card: string }[];
				trump: string;
				turn: number;
			};
			await ctx.db.patch(row._id, {
				game: {
					...game,
					trump: "H",
					hands: [["H7#0", "DA#0"], ["C7#0"], ["C8#0"], ["C9#0"]],
					trick: [{ seat: 3, card: "SA#0" }],
					turn: 0,
				},
			});
		});
		await expectCode(
			t.mutation(api.cardGames.act, {
				...me,
				action: { type: "play", card: "DA#0" },
			}),
			"cardsMustTrump",
		);
		await t.run(async (ctx) => {
			const row = await ctx.db.query("cardGameStates").unique();
			if (!row) throw new Error("the table has no state");
			await ctx.db.patch(row._id, { game: stored.game });
		});

		await t.mutation(api.cardGames.setAutopilot, { ...me, seat: 0, on: true });
		await (
			t.finishAllScheduledFunctions as (
				advance: () => void,
				maxIterations: number,
			) => Promise<void>
		)(vi.runAllTimers, 20_000);
		const done = await read(t, me);
		expect(done.status).toBe("finished");
		const final = done.view as unknown as {
			winners: number[];
			scores: number[][];
		};
		expect(final.scores).toHaveLength(16);
		expect(new Set(final.winners.map((seat) => seat % 2)).size).toBe(
			final.winners.length === 4 ? 2 : 1,
		);
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
	});

	it("needs exactly four players", async () => {
		const t = setup();
		await expect(soloTable(t, "klaverjassen", 2)).rejects.toThrow();
		await expect(soloTable(t, "klaverjassen", 4)).rejects.toThrow();
	});
});

describe("toepen", () => {
	type ToepenView = {
		hand: string[];
		phase: string;
		stake: number | null;
		canKnock: boolean;
		knock: { by: number | null } | null;
		totals: number[];
	};

	it("knocks, gets answers from the computers, and plays a solo table to the end", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.cardGames.createTable,
			tableArgs({ gameId: "toepen", bots: 3, options: ["vuileWas"] }),
		);
		const me = creds(sessionId, participantId);
		const start = (await read(t, me)).view as unknown as ToepenView;
		expect(start.hand).toHaveLength(4);
		expect(start.stake).toBe(1);
		expect(start.canKnock).toBe(true);

		const stored = await t.run((ctx) =>
			ctx.db.query("cardGameStates").unique(),
		);
		if (!stored) throw new Error("the table has no state");
		const game = stored.game as { hands: string[][]; stock: string[] };
		const mine = JSON.stringify(await read(t, me));
		for (const card of [...game.hands.slice(1).flat(), ...game.stock]) {
			expect(mine).not.toContain(`"${card}"`);
		}

		await expectCode(
			t.mutation(api.cardGames.act, { ...me, action: { type: "stay" } }),
			"cardsNothingToAnswer",
		);
		await t.mutation(api.cardGames.act, { ...me, action: { type: "knock" } });
		const knocked = (await read(t, me)).view as unknown as ToepenView;
		expect(knocked.phase).toBe("knocking");
		expect(knocked.stake).toBe(2);
		expect(knocked.knock?.by).toBe(0);
		await expectCode(
			t.mutation(api.cardGames.act, { ...me, action: { type: "fold" } }),
			"cardsOwnKnock",
		);

		// The computers answer; the seat that knocked can't knock again straight away.
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const answered = (await read(t, me)).view as unknown as ToepenView;
		expect(answered.phase).not.toBe("knocking");
		await expectCode(
			t.mutation(api.cardGames.act, { ...me, action: { type: "knock" } }),
			answered.phase === "playing" ? "cardsKnockedLast" : "noActiveRound",
		);

		await t.mutation(api.cardGames.setAutopilot, { ...me, seat: 0, on: true });
		await (
			t.finishAllScheduledFunctions as (
				advance: () => void,
				maxIterations: number,
			) => Promise<void>
		)(vi.runAllTimers, 20_000);
		const done = await read(t, me);
		expect(done.status).toBe("finished");
		const final = done.view as unknown as ToepenView & { winners: number[] };
		expect(final.winners).toHaveLength(1);
		expect(final.totals.filter((total) => total < 10)).toHaveLength(1);
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
	});

	it("refuses an unknown house rule", async () => {
		const t = setup();
		await expectCode(
			t.mutation(
				api.cardGames.createTable,
				tableArgs({ gameId: "toepen", options: ["blindKnock"] }),
			),
			"cardsUnknownOption",
		);
	});
});

describe("boerenbridge", () => {
	type BridgeView = {
		hand: string[];
		phase: string;
		turn: number;
		bids: Array<number | null> | null;
		legalBids: number[];
		handSize: number;
		turnedUp: string | null;
	};

	it("bids, plays and finishes a solo table against two computers", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t, "boerenbridge", 2);
		const me = creds(sessionId, participantId);
		const table = await read(t, me);
		const start = table.view as unknown as BridgeView;
		expect(start.phase).toBe("bidding");
		expect(start.handSize).toBe(1);
		expect(start.hand).toHaveLength(1);
		expect(start.turnedUp).toBeTruthy();
		// The host sits left of the dealer, so bids first.
		expect(start.turn).toBe(table.you);
		expect(start.legalBids).toEqual([0, 1]);

		await expectCode(
			t.mutation(api.cardGames.act, {
				...me,
				action: { type: "play", card: start.hand[0] },
			}),
			"cardsBidFirst",
		);
		await expectCode(
			t.mutation(api.cardGames.act, {
				...me,
				action: { type: "bid", count: 2 },
			}),
			"cardsBidRange",
			{ max: 1 },
		);
		await t.mutation(api.cardGames.act, {
			...me,
			action: { type: "bid", count: 0 },
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const bid = (await read(t, me)).view as unknown as BridgeView;
		expect(bid.bids?.[0]).toBe(0);
		expect(bid.bids?.every((count) => count !== null)).toBe(true);

		await t.mutation(api.cardGames.setAutopilot, { ...me, seat: 0, on: true });
		await (
			t.finishAllScheduledFunctions as (
				advance: () => void,
				maxIterations: number,
			) => Promise<void>
		)(vi.runAllTimers, 20_000);
		const done = await read(t, me);
		expect(done.status).toBe("finished");
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
	}, 30_000);

	it("refuses house rules that change the same thing", async () => {
		const t = setup();
		await expectCode(
			t.mutation(
				api.cardGames.createTable,
				tableArgs({
					gameId: "boerenbridge",
					bots: 2,
					options: ["upOnly", "downOnly"],
				}),
			),
			"cardsOptionsClash",
		);
	});
});

describe("gin rummy", () => {
	it("refuses a table with two computer players", async () => {
		const t = setup();
		await expectCode(
			t.mutation(api.cardGames.createTable, tableArgs({ gameId: "gin-rummy" })),
			"cardsTableFull",
		);
	});

	it("deals a solo table, keeps the computer's hand hidden, and plays a turn", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t, "gin-rummy", 1);
		const table = await read(t, creds(sessionId, participantId));
		expect(table.status).toBe("playing");
		expect(table.view.family).toBe("gin");
		expect(table.view.hand).toHaveLength(10);
		expect(table.view.handCounts).toEqual([10, 10]);
		const stored = await t.run((ctx) =>
			ctx.db.query("cardGameStates").unique(),
		);
		const theirs: string[] = stored?.game.hands[1] ?? [];
		for (const card of theirs) {
			expect(JSON.stringify(table.view)).not.toContain(`"${card}"`);
		}
		// The person on the first seat leads the first hand.
		expect(table.view.turn).toBe(0);
		await t.mutation(api.cardGames.act, {
			...creds(sessionId, participantId),
			action: { type: "drawStock" },
		});
		const drawn = await read(t, creds(sessionId, participantId));
		expect(drawn.view.hand).toHaveLength(11);
		await expectCode(
			t.mutation(api.cardGames.act, {
				...creds(sessionId, participantId),
				action: { type: "finishLayoff" },
			}),
			"cardsNoKnock",
		);
		await t.mutation(api.cardGames.act, {
			...creds(sessionId, participantId),
			action: { type: "discard", card: drawn.view.hand[0] },
		});
		const after = await read(t, creds(sessionId, participantId));
		expect(after.view.hand).toHaveLength(10);
	});

	it("plays a whole match on autopilot", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t, "gin-rummy", 1);
		await t.mutation(api.cardGames.setAutopilot, {
			...creds(sessionId, participantId),
			seat: 0,
			on: true,
		});
		await (
			t.finishAllScheduledFunctions as (
				advance: () => void,
				maxIterations: number,
			) => Promise<void>
		)(vi.runAllTimers, 10_000);
		const done = await read(t, creds(sessionId, participantId));
		expect(done.status).toBe("finished");
		expect(Math.max(...(done.view.totals ?? []))).toBeGreaterThanOrEqual(100);
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
	});
});

describe("getTable", () => {
	it("answers a mistyped table link with nothing", async () => {
		const t = setup();
		await expect(
			t.query(api.cardGames.getTable, { sessionId: "not-a-table" }),
		).resolves.toBeNull();
	});
});

describe("autopilot permissions", () => {
	async function started(t: T) {
		const room = await roomTable(t);
		await t.mutation(
			api.cardGames.takeSeat,
			creds(room.sessionId, room.guestId, SECRET_B),
		);
		await t.mutation(
			api.cardGames.start,
			creds(room.sessionId, room.participantId),
		);
		return room;
	}

	it("the host can hand over a seat; a player can't while it's active", async () => {
		const t = setup();
		const { sessionId, participantId, guestId } = await started(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(participantId, { lastSeen: Date.now() });
		});
		await expect(
			t.mutation(api.cardGames.setAutopilot, {
				...creds(sessionId, guestId, SECRET_B),
				seat: 0,
				on: true,
			}),
		).rejects.toThrow();
		await t.mutation(api.cardGames.setAutopilot, {
			...creds(sessionId, participantId),
			seat: 1,
			on: true,
		});
		const table = await read(t, { sessionId });
		expect(table.seats[1].autopilot).toBe(true);
	});

	it("anyone seated can hand over a silent seat, and only the owner takes it back", async () => {
		const t = setup();
		const { sessionId, participantId, guestId } = await started(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(participantId, { lastSeen: Date.now() - 120_000 });
		});
		await t.mutation(api.cardGames.setAutopilot, {
			...creds(sessionId, guestId, SECRET_B),
			seat: 0,
			on: true,
		});
		await expect(
			t.mutation(api.cardGames.setAutopilot, {
				...creds(sessionId, guestId, SECRET_B),
				seat: 0,
				on: false,
			}),
		).rejects.toThrow();
		await t.mutation(api.cardGames.setAutopilot, {
			...creds(sessionId, participantId),
			seat: 0,
			on: false,
		});
		const table = await read(t, { sessionId });
		expect(table.seats[0].autopilot).toBe(false);
	});
});

describe("house rules that need a number of players", () => {
	/** A solo Mau-Mau table with the nine house rule, seat 0 about to play a nine on a nine. */
	async function nineTable(bots: number) {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.cardGames.createTable,
			tableArgs({ gameId: "maumau", bots, options: ["nineReverses"] }),
		);
		const stored = await t.run((ctx) =>
			ctx.db.query("cardGameStates").unique(),
		);
		if (!stored) throw new Error("no table");
		expect(stored.options).toEqual(["nineReverses"]);
		const hands = [
			["S9#0", "DK#0", "HQ#0"],
			["C8#0", "DA#0"],
			["H10#0", "CQ#0"],
		].slice(0, bots + 1);
		await t.run((ctx) =>
			ctx.db.patch(stored._id, {
				game: {
					...stored.game,
					hands,
					stock: ["D8#0", "C10#0", "H8#0"],
					discard: ["H9#0"],
					turn: 0,
					direction: 1,
					pendingDraw: 0,
					activeSuit: null,
					drawnCard: null,
				} as typeof stored.game,
			}),
		);
		const me = creds(sessionId, participantId);
		await t.mutation(api.cardGames.act, {
			...me,
			action: { type: "play", card: "S9#0" },
		});
		const after = await t.run((ctx) => ctx.db.query("cardGameStates").unique());
		return after?.game as { direction: number; turn: number };
	}

	it("keeps the rule on a table too small for it, and plays the card plain", async () => {
		expect(await nineTable(1)).toMatchObject({ direction: 1, turn: 1 });
	});

	it("enforces the rule once the table has enough players", async () => {
		expect(await nineTable(2)).toMatchObject({ direction: -1, turn: 2 });
	});
});

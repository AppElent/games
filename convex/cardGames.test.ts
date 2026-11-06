/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET_A = "secret-a-0123456789";
const SECRET_B = "secret-b-0123456789";

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
		guestId: "guest_me",
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
		guestId: "guest_two",
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
				guestId: "guest_me",
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
		const mine = JSON.stringify(
			await read(t, creds(sessionId, participantId)));
		for (const card of [...game.hands[1], ...game.stock]) {
			expect(mine).not.toContain(`"${card}"`);
		}
		expect(mine).not.toContain(SECRET_A);
		expect(mine).not.toContain("guest_me");
	});

	it("treats a public participant id without the secret as a spectator", async () => {
		const t = setup();
		const { sessionId, participantId } = await soloTable(t);
		const spoof = await read(t, creds(sessionId, participantId, "wrong-secret-123456"));
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
				...creds(sessionId, participantId, "wrong-secret-123456"),
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
				creds(sessionId, participantId, "another-secret-1234"),
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
				creds(sessionId, guestId, "attacker-secret-0123"),
			),
		).rejects.toThrow();
		const peek = await read(t, creds(sessionId, guestId, "attacker-secret-0123"));
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
				creds(sessionId, guestId, "attacker-secret-0123"),
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
			guestId: "guest_watch",
			asSpectator: true,
			seatSecret: SECRET_B,
		});
		expect((await read(t, { sessionId })).seats).toHaveLength(1);
		await expect(
			t.mutation(api.sessions.joinByCode, {
				joinCode,
				displayName: "Short",
				guestId: "guest_short",
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
				guestId: "guest_watch",
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
				creds(sessionId, joined.participantId, "attacker-secret-0123"),
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
			guestId: "guest_three",
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
				creds(sessionId, late, "late-secret-0123456"),
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
		expect(
			after.view.phase === "finished" || after.view.turn === 0,
		).toBe(true);
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

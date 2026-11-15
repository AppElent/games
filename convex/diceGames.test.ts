/// <reference types="vite/client" />
import type { DiceAction } from "@arcadeclub/core/dice/engine";
import type { ScoresheetView } from "@arcadeclub/core/dice/scoresheet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { expectCode, setup, type T } from "./test.helpers";

const SECRET_A = "secret-a-0123456789";
const SECRET_B = "secret-b-0123456789";

type SessionId = Id<"gameSessions">;
type ParticipantId = Id<"sessionParticipants">;

function tableArgs(overrides: Record<string, unknown> = {}) {
	return {
		seatSecret: SECRET_A,
		joinMode: "solo" as const,
		title: "Yatzy",
		displayName: "Me",
		guestId: "guest_me",
		gameId: "yatzy",
		options: [] as string[],
		bots: 0,
		start: true,
		...overrides,
	};
}

const creds = (
	sessionId: SessionId,
	participantId: ParticipantId,
	seatSecret = SECRET_A,
) => ({ sessionId, participantId, seatSecret });

async function read(
	t: T,
	args: {
		sessionId: SessionId;
		participantId?: ParticipantId;
		seatSecret?: string;
	},
) {
	const table = await t.query(api.diceGames.getTable, args);
	if (!table?.view) {
		throw new Error("table not found");
	}
	return { ...table, view: table.view as ScoresheetView };
}

async function rawState(t: T) {
	const row = await t.run((ctx) => ctx.db.query("cardGameStates").unique());
	return row as NonNullable<typeof row>;
}

/** A finished bot game: lets the runner play every scheduled step. */
async function runBots(t: T) {
	await (
		t.finishAllScheduledFunctions as (
			advance: () => void,
			maxIterations: number,
		) => Promise<void>
	)(vi.runAllTimers, 5_000);
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("a solo Yatzy table", () => {
	it("plays a whole game alone, scoring through the server", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs(),
		);
		const me = creds(sessionId, participantId);
		let table = await read(t, me);
		expect(table.status).toBe("playing");
		expect(table.you).toBe(0);
		expect(table.view.rounds).toBe(15);
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.gameType).toBe("dice-games");
		expect(session?.status).toBe("active");

		for (let round = 0; round < 15; round += 1) {
			await t.mutation(api.diceGames.act, {
				...me,
				action: { type: "roll", keep: [] },
			});
			await t.mutation(api.diceGames.act, {
				...me,
				action: { type: "roll", keep: [0, 1] },
			});
			table = await read(t, me);
			const [option] = table.view.options;
			await t.mutation(api.diceGames.act, {
				...me,
				action: { type: "score", category: option.category },
			});
		}
		table = await read(t, me);
		expect(table.status).toBe("finished");
		expect(table.view.winners).toEqual([0]);
		const done = await t.run((ctx) => ctx.db.get(sessionId));
		expect(done?.status).toBe("completed");

		await t.mutation(api.diceGames.rematch, me);
		table = await read(t, me);
		expect(table.status).toBe("playing");
		expect(table.view.round).toBe(1);
	});

	it("refuses a roll that names its own dice", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs(),
		);
		const me = creds(sessionId, participantId);
		await expect(
			t.mutation(api.diceGames.act, {
				...me,
				action: {
					type: "roll",
					keep: [],
					dice: [6, 6, 6, 6, 6],
				} as DiceAction,
			}),
		).rejects.toThrow(/Validator error/);
		expect((await read(t, me)).view.rollsUsed).toBe(0);
		// Nothing stored would let anyone predict the next roll.
		expect(Object.keys((await rawState(t)).game)).not.toContain("seed");
	});

	it("refuses bad moves with their own codes", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs({ options: ["yahtzeeSheet"] }),
		);
		const me = creds(sessionId, participantId);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "score", category: "chance" },
			}),
			"diceRollFirst",
		);
		await t.mutation(api.diceGames.act, {
			...me,
			action: { type: "roll", keep: [] },
		});
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "roll", keep: [7] },
			}),
			"diceInvalidHold",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "score", category: "onePair" },
			}),
			"diceUnknownCategory",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...creds(sessionId, participantId, SECRET_B),
				action: { type: "roll", keep: [] },
			}),
			"cardsNotSeated",
		);
	});

	it("rejects unknown games, house rules and too many computer players", async () => {
		const t = setup();
		await expectCode(
			t.mutation(api.diceGames.createTable, tableArgs({ gameId: "farkle" })),
			"gameNotFound",
		);
		await expectCode(
			t.mutation(api.diceGames.createTable, tableArgs({ options: ["nope"] })),
			"cardsUnknownOption",
		);
		await expectCode(
			t.mutation(api.diceGames.createTable, tableArgs({ bots: 6 })),
			"cardsTableFull",
		);
		await expectCode(
			t.mutation(api.diceGames.createTable, tableArgs({ gameId: "pesten" })),
			"gameNotFound",
		);
	});

	it("lets computer players take their turns", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs({ bots: 2 }),
		);
		const me = creds(sessionId, participantId);
		await t.mutation(api.diceGames.act, {
			...me,
			action: { type: "roll", keep: [] },
		});
		await t.mutation(api.diceGames.act, {
			...me,
			action: { type: "score", category: "chance" },
		});
		await runBots(t);
		const table = await read(t, me);
		expect(table.view.turn).toBe(0);
		expect(table.view.round).toBe(2);
		expect(Object.keys(table.view.sheets[1].scores)).toHaveLength(1);
		expect(Object.keys(table.view.sheets[2].scores)).toHaveLength(1);
	});

	it("finishes a game played entirely on autopilot", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs({ bots: 1, options: ["yahtzeeSheet"] }),
		);
		const me = creds(sessionId, participantId);
		await t.mutation(api.diceGames.setAutopilot, { ...me, seat: 0, on: true });
		await runBots(t);
		const table = await read(t, me);
		expect(table.status).toBe("finished");
		expect(table.view.winners.length).toBeGreaterThan(0);
	});

	it("ignores a stale bot job", async () => {
		const t = setup();
		await t.mutation(api.diceGames.createTable, tableArgs({ bots: 1 }));
		const before = await rawState(t);
		await t.mutation(internal.diceGames.botStep, {
			tableId: before._id,
			version: 999,
		});
		expect((await rawState(t)).version).toBe(before.version);
	});
});

describe("a Yatzy room", () => {
	it("seats a friend who joins with the code, then plays in turn", async () => {
		const t = setup();
		const host = t.withIdentity({ subject: "user_host" });
		const { sessionId, participantId, joinCode } = await host.mutation(
			api.diceGames.createTable,
			tableArgs({
				joinMode: "room",
				displayName: "Host",
				guestId: undefined,
				start: false,
			}),
		);
		const guest = await t.mutation(api.sessions.joinByCode, {
			joinCode: joinCode as string,
			displayName: "Guest",
			guestId: "guest_two",
			seatSecret: SECRET_B,
		});
		expect(guest.gameType).toBe("dice-games");
		expect(guest.seatClaimed).toBe(true);
		const hostCreds = creds(sessionId, participantId);
		const guestCreds = creds(sessionId, guest.participantId, SECRET_B);
		await expectCode(t.mutation(api.diceGames.start, guestCreds), "hostOnly");
		await host.mutation(api.diceGames.start, hostCreds);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...guestCreds,
				action: { type: "roll", keep: [] },
			}),
			"notYourTurn",
		);
		const spectator = await read(t, { sessionId });
		expect(spectator.you).toBeNull();
		expect(spectator.seats).toHaveLength(2);
	});

	it("is only created through its own mutation", async () => {
		const t = setup();
		await expectCode(
			t.withIdentity({ subject: "user_host" }).mutation(api.sessions.create, {
				gameType: "dice-games",
				joinMode: "room",
				authPolicy: "guestAllowed",
				title: "Yatzy",
				displayName: "Host",
			}),
			"gameUnavailable",
		);
	});
});

/// <reference types="vite/client" />
import type { BiddingView } from "@arcadeclub/core/dice/bidding";
import type { DiceAction, DiceView } from "@arcadeclub/core/dice/engine";
import type {
	PushluckState,
	PushluckView,
} from "@arcadeclub/core/dice/pushluck";
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

async function read<View extends DiceView = ScoresheetView>(
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
	return { ...table, view: table.view as View };
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

describe("a solo 10.000 table", () => {
	const tienduizend = (overrides: Record<string, unknown> = {}) =>
		tableArgs({
			title: "10.000",
			gameId: "tienduizend",
			bots: 1,
			...overrides,
		});

	/** Puts known dice on the table, in front of the first seat. */
	async function setDice(t: T, dice: number[]) {
		const row = await rawState(t);
		await t.run((ctx) =>
			ctx.db.patch(row._id, {
				game: { ...(row.game as PushluckState), dice, turn: 0 },
			}),
		);
	}

	it("needs a second player", async () => {
		const t = setup();
		await expectCode(
			t.mutation(api.diceGames.createTable, tienduizend({ bots: 0 })),
			"notEnoughPlayers",
		);
	});

	it("rolls, sets aside and banks through the server, then the computer plays", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tienduizend(),
		);
		const me = creds(sessionId, participantId);
		let table = await read<PushluckView>(t, me);
		expect(table.view.family).toBe("pushluck");
		expect(table.view.rules.target).toBe(10_000);
		expect(table.view.turn).toBe(0);
		await t.mutation(api.diceGames.act, {
			...me,
			action: { type: "roll", keep: [] },
		});
		table = await read<PushluckView>(t, me);
		// Six fresh dice, unless that roll scored nothing and bust the turn.
		if (table.view.turn === 0) {
			expect(table.view.dice).toHaveLength(6);
		} else {
			expect(table.view.events.at(-1)?.type).toBe("bust");
		}
		// The roll came from the server; nothing stored predicts the next one.
		expect(Object.keys((await rawState(t)).game)).not.toContain("seed");

		await setDice(t, [1, 5, 2, 3, 4, 6]);
		await t.mutation(api.diceGames.act, {
			...me,
			action: { type: "bank", keep: [0, 1] },
		});
		table = await read<PushluckView>(t, me);
		expect(table.view.scores[0]).toBe(150);
		expect(table.view.turn).toBe(1);
		await runBots(t);
		table = await read<PushluckView>(t, me);
		expect(table.view.turn).toBe(0);
		expect(table.view.round).toBe(2);
	});

	it("refuses illegal set-asides with their own codes", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tienduizend({ options: ["opening500"] }),
		);
		const me = creds(sessionId, participantId);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "bank", keep: [0] },
			}),
			"diceRollFirst",
		);
		await setDice(t, [1, 5, 2, 3, 4, 6]);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "roll", keep: [] },
			}),
			"diceSetAsideFirst",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "roll", keep: [0, 2] },
			}),
			"diceNotScoring",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "bank", keep: [0, 1] },
			}),
			"diceBelowOpening",
			{ needed: 500, have: 150 },
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "roll", keep: [9] },
			}),
			"diceInvalidHold",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "score", category: "chance" },
			}),
			"cardsWrongAction",
		);
		const table = await read<PushluckView>(t, me);
		expect(table.view.dice).toEqual([1, 5, 2, 3, 4, 6]);
		expect(table.view.turnTotal).toBe(0);
	});

	it("finishes a game played entirely by the computer and deals a rematch", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tienduizend({ bots: 2, options: ["opening350", "fixedKinds"] }),
		);
		const me = creds(sessionId, participantId);
		await t.mutation(api.diceGames.setAutopilot, { ...me, seat: 0, on: true });
		await runBots(t);
		let table = await read<PushluckView>(t, me);
		expect(table.status).toBe("finished");
		const best = Math.max(...table.view.scores);
		expect(best).toBeGreaterThanOrEqual(10_000);
		expect(
			table.view.winners.every((seat) => table.view.scores[seat] === best),
		).toBe(true);
		const done = await t.run((ctx) => ctx.db.get(sessionId));
		expect(done?.status).toBe("completed");

		await t.mutation(api.diceGames.setAutopilot, { ...me, seat: 0, on: false });
		await t.mutation(api.diceGames.rematch, me);
		table = await read<PushluckView>(t, me);
		expect(table.status).toBe("playing");
		expect(table.view.scores).toEqual([0, 0, 0]);
		expect(table.view.turn).toBe(1);
	});
});

describe("a solo liar's dice table", () => {
	const liars = (overrides: Record<string, unknown> = {}) =>
		tableArgs({ title: "Liar's Dice", gameId: "liars-dice", ...overrides });

	async function cups(t: T) {
		const state = (await rawState(t)).game as { cups: number[][] };
		return state.cups;
	}

	it("needs a computer opponent to play alone", async () => {
		const t = setup();
		await expectCode(
			t.mutation(api.diceGames.createTable, liars()),
			"notEnoughPlayers",
		);
	});

	it("shows each player only their own cup until the reveal", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			liars({ bots: 2, options: ["wildOnes"] }),
		);
		const me = creds(sessionId, participantId);
		const table = await read<BiddingView>(t, me);
		const [mine, ...others] = await cups(t);
		expect(table.view.yourDice).toEqual(mine);
		expect(table.view.diceCounts).toEqual([5, 5, 5]);
		expect(table.view.rules.wildOnes).toBe(true);
		expect(JSON.stringify(table.view)).not.toContain("cups");
		expect(others.every((cup) => cup.length === 5)).toBe(true);

		const spectator = await read<BiddingView>(t, { sessionId });
		expect(spectator.you).toBeNull();
		expect(spectator.view.yourDice).toEqual([]);
	});

	it("takes bids and calls through the server, then lets the bots finish", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			liars({ bots: 2, options: ["spotOn", "threeDice"] }),
		);
		const me = creds(sessionId, participantId);
		await expectCode(
			t.mutation(api.diceGames.act, { ...me, action: { type: "liar" } }),
			"noClaimToChallenge",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "bid", quantity: 10, face: 2 },
			}),
			"claimImpossible",
		);
		await t.mutation(api.diceGames.act, {
			...me,
			action: { type: "bid", quantity: 1, face: 2 },
		});
		let table = await read<BiddingView>(t, me);
		expect(table.view.diceCounts).toEqual([3, 3, 3]);
		expect(table.view.bids).toEqual([{ seat: 0, quantity: 1, face: 2 }]);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "bid", quantity: 2, face: 2 },
			}),
			"notYourTurn",
		);

		await t.mutation(api.diceGames.setAutopilot, { ...me, seat: 0, on: true });
		await runBots(t);
		table = await read<BiddingView>(t, me);
		expect(table.status).toBe("finished");
		expect(table.view.winners).toHaveLength(1);
		expect(table.view.diceCounts.filter((count) => count > 0)).toHaveLength(1);
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.status).toBe("completed");
	});

	it("refuses another family's moves and a call the house rules leave out", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			liars({ bots: 1 }),
		);
		const me = creds(sessionId, participantId);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...me,
				action: { type: "roll", keep: [] },
			}),
			"cardsWrongAction",
		);
		await expectCode(
			t.mutation(api.diceGames.act, { ...me, action: { type: "spotOn" } }),
			"diceSpotOnOff",
		);
	});

	it("rejects a bid that carries its own dice", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			liars({ bots: 1 }),
		);
		await expect(
			t.mutation(api.diceGames.act, {
				...creds(sessionId, participantId),
				action: {
					type: "bid",
					quantity: 1,
					face: 2,
					dice: [2, 2, 2, 2, 2],
				} as DiceAction,
			}),
		).rejects.toThrow(/Validator error/);
	});
});

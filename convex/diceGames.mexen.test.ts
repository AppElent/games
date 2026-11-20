/// <reference types="vite/client" />
import type { MexenView } from "@arcadeclub/core/dice/mexen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	expectCode,
	guestIdOf,
	seatSecretOf,
	setup,
	type T,
} from "./test.helpers";

// Mexen plays through the shared dice table module (`diceGames`); these
// tests cover what the family adds to it: a stand action and many bots.

const SECRET = seatSecretOf("a");

type SessionId = Id<"gameSessions">;
type ParticipantId = Id<"sessionParticipants">;

function tableArgs(overrides: Record<string, unknown> = {}) {
	return {
		seatSecret: SECRET,
		joinMode: "solo" as const,
		title: "Mexico",
		displayName: "Me",
		guestId: guestIdOf("me"),
		gameId: "mexen",
		options: [] as string[],
		bots: 2,
		start: true,
		...overrides,
	};
}

async function read(
	t: T,
	args: { sessionId: SessionId; participantId: ParticipantId },
) {
	const table = await t.query(api.diceGames.getTable, {
		...args,
		seatSecret: SECRET,
	});
	if (!table?.view) {
		throw new Error("table not found");
	}
	return { ...table, view: table.view as MexenView };
}

/** Lets the runner play every scheduled computer move. */
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

describe("a solo Mexen table", () => {
	it("plays a whole game against the computer through the server", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs({ options: ["lives3"] }),
		);
		const me = { sessionId, participantId };
		const auth = { ...me, seatSecret: SECRET };
		let table = await read(t, me);
		expect(table.status).toBe("playing");
		expect(table.view.family).toBe("mexen");
		expect(table.view.livesLeft).toEqual([3, 3, 3]);
		expect(table.view.turn).toBe(0);

		for (let step = 0; step < 500; step += 1) {
			table = await read(t, me);
			if (table.status === "finished") {
				break;
			}
			if (table.view.turn !== 0 || table.view.out[0]) {
				await runBots(t);
				continue;
			}
			// Stand on the first throw, so the computer gets one throw too.
			await t.mutation(api.diceGames.act, {
				...auth,
				action:
					table.view.rollsUsed === 0
						? { type: "roll", keep: [] }
						: { type: "stand" },
			});
		}
		expect(table.status).toBe("finished");
		expect(table.view.winners).toHaveLength(1);
		expect(table.view.livesLeft.filter((lives) => lives > 0)).toHaveLength(1);
		const done = await t.run((ctx) => ctx.db.get(sessionId));
		expect(done?.status).toBe("completed");

		await t.mutation(api.diceGames.rematch, auth);
		table = await read(t, me);
		expect(table.status).toBe("playing");
		expect(table.view.round).toBe(1);
		expect(table.view.turn).toBe(1);
	});

	it("refuses moves the family does not allow, each with its own code", async () => {
		const t = setup();
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs(),
		);
		const auth = { sessionId, participantId, seatSecret: SECRET };
		await expectCode(
			t.mutation(api.diceGames.act, { ...auth, action: { type: "stand" } }),
			"diceRollFirst",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...auth,
				action: { type: "roll", keep: [0] },
			}),
			"diceInvalidHold",
		);
		await expectCode(
			t.mutation(api.diceGames.act, {
				...auth,
				action: { type: "score", category: "chance" },
			}),
			"cardsWrongAction",
		);
		await t.mutation(api.diceGames.act, {
			...auth,
			action: { type: "roll", keep: [] },
		});
		const table = await read(t, { sessionId, participantId });
		expect(table.view.rollsUsed).toBe(1);
		expect(table.view.current).not.toBeNull();
	});

	it("seats up to eight and needs a second player to start", async () => {
		const t = setup();
		await expectCode(
			t.mutation(api.diceGames.createTable, tableArgs({ bots: 8 })),
			"cardsTableFull",
		);
		await expectCode(
			t.mutation(api.diceGames.createTable, tableArgs({ bots: 0 })),
			"notEnoughPlayers",
		);
		await expectCode(
			t.mutation(
				api.diceGames.createTable,
				tableArgs({ options: ["lives3", "lives10"] }),
			),
			"cardsOptionsClash",
		);
		const { sessionId, participantId } = await t.mutation(
			api.diceGames.createTable,
			tableArgs({ bots: 7, options: ["points", "littleMex"] }),
		);
		const table = await read(t, { sessionId, participantId });
		expect(table.seats).toHaveLength(8);
		expect(table.view.scoring).toBe("points");
		expect(table.view.littleMex).toBe(true);
	});
});

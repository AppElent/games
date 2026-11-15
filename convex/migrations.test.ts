import type { BiddingView } from "@arcadeclub/core/dice/bidding";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { hostGame } from "./lib/hostedSession";
import {
	fixRandom,
	freezeClock,
	HOSTED,
	joinWithCode,
	type ParticipantId,
	type SessionId,
	setup,
	signedInHost,
	type T,
	T0,
} from "./test.helpers";

freezeClock();

/** A guest's browser id, long enough to prove the seat it held. */
const GUEST_ID = "4f9c2a7e-1b3d-4c5e-8f6a-9b0c1d2e3f40";
/** Every die lands on this face while `fixRandom(ALL_FOURS)` is active. */
const ALL_FOURS = 0.5;

/** A Bluff Dice room as `bluffDice.create` used to open it. */
async function legacyRoom(t: T) {
	const host = signedInHost(t);
	const { session, participantId } = await host.run(async (ctx) => {
		const hosted = await hostGame(ctx, "bluff-dice", HOSTED);
		await ctx.db.insert("bluffDiceStates", {
			sessionId: hosted.session._id,
			phase: "lobby",
			turnOrder: [],
			hands: [],
			activeIndex: 0,
			roundNumber: 0,
			claimHistory: [],
			createdAt: T0,
			updatedAt: T0,
		});
		return hosted;
	});
	const guest = await joinWithCode(t, session.joinCode as string, GUEST_ID);
	return {
		host,
		sessionId: session._id,
		hostId: participantId,
		guestId: guest.participantId,
	};
}

async function startedRoom(t: T) {
	const room = await legacyRoom(t);
	fixRandom(ALL_FOURS);
	await t.mutation(api.bluffDice.start, {
		sessionId: room.sessionId,
		participantId: room.hostId,
	});
	return room;
}

function migrate(t: T) {
	return t.mutation(internal.migrations.bluffDiceToDiceTables, {});
}

async function tableOf(t: T, sessionId: SessionId) {
	return (await t.run((ctx) =>
		ctx.db
			.query("cardGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique(),
	)) as Doc<"cardGameStates">;
}

async function guestView(t: T, sessionId: SessionId, guestId: ParticipantId) {
	const table = await t.query(api.diceGames.getTable, {
		sessionId,
		participantId: guestId,
		seatSecret: GUEST_ID,
	});
	return { ...table, view: table?.view as BiddingView };
}

describe("moving Bluff Dice onto the dice tables", () => {
	it("carries a game in progress on as liar's dice with every house rule off", async () => {
		const t = setup();
		const { host, sessionId, hostId, guestId } = await startedRoom(t);
		await t.mutation(api.bluffDice.submitClaim, {
			sessionId,
			participantId: hostId,
			quantity: 3,
			face: 4,
		});

		expect(await migrate(t)).toEqual({ converted: 1, done: true });

		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.gameType).toBe("dice-games");
		expect(
			await t.run((ctx) => ctx.db.query("bluffDiceStates").collect()),
		).toEqual([]);
		const table = await tableOf(t, sessionId);
		expect(table.gameId).toBe("liars-dice");
		expect(table.options).toEqual([]);
		expect(table.status).toBe("playing");
		expect(table.seats.map((seat) => seat.participantId)).toEqual([
			hostId,
			guestId,
		]);

		const guest = await guestView(t, sessionId, guestId);
		expect(guest.you).toBe(1);
		expect(guest.view.yourDice).toEqual([4, 4, 4, 4, 4]);
		expect(guest.view.bids).toEqual([{ seat: 0, quantity: 3, face: 4 }]);
		expect(guest.view.turn).toBe(1);
		expect(guest.view.rules).toEqual({
			startingDice: 5,
			wildOnes: false,
			spotOn: false,
		});

		// The guest calls on: their browser's guest id is the seat's secret.
		await t.mutation(api.diceGames.act, {
			sessionId,
			participantId: guestId,
			seatSecret: GUEST_ID,
			action: { type: "liar" },
		});
		const after = await guestView(t, sessionId, guestId);
		expect(after.view.reveal?.losers).toEqual([1]);
		expect(after.view.diceCounts).toEqual([5, 4]);

		// The signed-in host proves the seat with their account instead.
		const secret = "host-secret-0123456789";
		expect(
			await host.mutation(api.diceGames.takeSeat, {
				sessionId,
				participantId: hostId,
				seatSecret: secret,
			}),
		).toBe(0);
	});

	it("seats a lobby's players without dealing", async () => {
		const t = setup();
		const { host, sessionId, hostId, guestId } = await legacyRoom(t);
		await migrate(t);
		const table = await tableOf(t, sessionId);
		expect(table.status).toBe("lobby");
		expect(table.game).toBeUndefined();
		expect(table.seats.map((seat) => seat.participantId)).toEqual([
			hostId,
			guestId,
		]);
		const secret = "host-secret-0123456789";
		await host.mutation(api.diceGames.takeSeat, {
			sessionId,
			participantId: hostId,
			seatSecret: secret,
		});
		await host.mutation(api.diceGames.start, {
			sessionId,
			participantId: hostId,
			seatSecret: secret,
		});
		expect((await tableOf(t, sessionId)).status).toBe("playing");
	});

	it("keeps a finished game's winner, and lets it rematch", async () => {
		const t = setup();
		const { host, sessionId, hostId, guestId } = await startedRoom(t);
		await t.run(async (ctx) => {
			const state = await ctx.db
				.query("bluffDiceStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
				.unique();
			await ctx.db.patch(state?._id as NonNullable<typeof state>["_id"], {
				phase: "finished",
				winnerParticipantId: guestId,
				hands: [
					{ participantId: hostId, values: [] },
					{ participantId: guestId, values: [4] },
				],
			});
		});
		await migrate(t);
		const table = await tableOf(t, sessionId);
		expect(table.status).toBe("finished");
		const guest = await guestView(t, sessionId, guestId);
		expect(guest.view.winners).toEqual([1]);
		expect(guest.view.outIn).toEqual([0, null]);

		const secret = "host-secret-0123456789";
		const hostSeat = { sessionId, participantId: hostId, seatSecret: secret };
		await host.mutation(api.diceGames.takeSeat, hostSeat);
		await host.mutation(api.diceGames.rematch, hostSeat);
		const rematch = await guestView(t, sessionId, guestId);
		expect(rematch.status).toBe("playing");
		expect(rematch.view.diceCounts).toEqual([5, 5]);
	});

	it("drops a state whose session is gone, and stops when nothing is left", async () => {
		const t = setup();
		const { sessionId } = await legacyRoom(t);
		await t.run((ctx) => ctx.db.delete(sessionId));
		expect(await migrate(t)).toEqual({ converted: 1, done: true });
		expect(
			await t.run((ctx) => ctx.db.query("cardGameStates").collect()),
		).toEqual([]);
		expect(await migrate(t)).toEqual({ converted: 0, done: true });
	});
});

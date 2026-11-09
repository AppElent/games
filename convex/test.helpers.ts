/// <reference types="vite/client" />
/**
 * Shared setup for the characterization suites. The two dots in this file's
 * name keep it out of the Convex deployment, like the `.test.ts` files.
 */
import type { GameErrorCode, GameErrorParams } from "@arcadeclub/core/errors";
import { ConvexError, type Value } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { StateTable } from "./lib/gameSession";
import { createHostedSession } from "./lib/hostedSession";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/** The clock every suite starts on, so stored timestamps can be asserted exactly. */
export const T0 = Date.UTC(2026, 0, 1, 12);

export function setup() {
	return convexTest(schema, modules);
}

export type T = ReturnType<typeof setup>;
export type SessionId = Id<"gameSessions">;
export type ParticipantId = Id<"sessionParticipants">;
export type GameType = Doc<"gameSessions">["gameType"];

/** Freezes the clock at `T0` for each test and undoes any `Math.random` mock. */
export function freezeClock() {
	beforeEach(() => {
		vi.useFakeTimers({ now: T0 });
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});
}

export function advance(ms: number) {
	vi.setSystemTime(Date.now() + ms);
}

/**
 * What a call reads from `Date.now()` once two calls have committed in the
 * frozen millisecond `at`. convex-test pins each call's clock at or after the
 * last commit, as the backend does, and every commit after the first in a
 * frozen millisecond lands just past it, so later calls read the next one.
 */
export function afterCommits(at: number) {
	return at + 1;
}

/**
 * Pins `Math.random` to one value. A constant rather than a sequence, because
 * convex-test draws from it for request ids between calls.
 */
export function fixRandom(value: number) {
	return vi.spyOn(Math, "random").mockReturnValue(value);
}

/** Alternates `Math.random` between two values, whichever comes first. */
export function alternateRandom(first: number, second: number) {
	let next = first;
	return vi.spyOn(Math, "random").mockImplementation(() => {
		const value = next;
		next = next === first ? second : first;
		return value;
	});
}

/**
 * Asserts a rejection carries exactly this keyed error. A crash or a different
 * code fails the test, unlike a bare `rejects.toThrow()`.
 */
export async function expectCode(
	action: Promise<unknown>,
	code: GameErrorCode,
	params?: GameErrorParams,
) {
	let caught: unknown;
	try {
		await action;
	} catch (error) {
		caught = error;
	}
	if (caught === undefined) {
		throw new Error(`Expected error code "${code}", but the call succeeded`);
	}
	expect(caught).toBeInstanceOf(ConvexError);
	expect((caught as ConvexError<Value>).data).toEqual(
		params ? { code, params } : { code },
	);
}

export function getDoc<Table extends TableNames>(t: T, id: Id<Table>) {
	return t.run((ctx) => ctx.db.get(id)) as Promise<Doc<Table> | null>;
}

/** A document's stored fields, for comparing whole rows with `toEqual`. */
export function fields<D extends { _id: unknown; _creationTime: unknown }>(
	doc: D | null | undefined,
) {
	if (!doc) {
		throw new Error("Expected a document");
	}
	const { _id, _creationTime, ...rest } = doc;
	return rest;
}

/** Writes a position no short test could play its way to. */
export function arrange<Table extends TableNames>(
	t: T,
	id: Id<Table>,
	patch: Partial<Doc<Table>>,
) {
	return t.run((ctx) => ctx.db.patch(id, patch as never));
}

/** An id of the right table that points at nothing. */
export async function deletedSessionId(t: T): Promise<SessionId> {
	return await t.run(async (ctx) => {
		const id = await ctx.db.insert("gameSessions", {
			gameType: "chess",
			status: "lobby",
			joinMode: "solo",
			authPolicy: "guestAllowed",
			title: "Deleted",
		});
		await ctx.db.delete(id);
		return id;
	});
}

export async function deletedParticipantId(
	t: T,
	sessionId: SessionId,
): Promise<ParticipantId> {
	return await t.run(async (ctx) => {
		const id = await ctx.db.insert("sessionParticipants", {
			sessionId,
			displayName: "Deleted",
			role: "player",
			connected: true,
			lastSeen: 0,
		});
		await ctx.db.delete(id);
		return id;
	});
}

export const HOST_USER = "user_host";

/**
 * A session and its signed-in host (every shared mode requires one) with no
 * game state yet, as a game's `create` makes them before inserting its state.
 */
export async function hostSession(
	t: T,
	gameType: GameType,
	joinMode: "room" | "challenge" | "solo",
	authPolicy:
		| "guestAllowed"
		| "hostChoice"
		| "signedInRequired" = "guestAllowed",
) {
	const host = t.withIdentity({ subject: HOST_USER });
	const { session, participantId } = await host.run((ctx) =>
		createHostedSession(ctx, { gameType, joinMode, authPolicy, ...HOSTED }),
	);
	return {
		host,
		sessionId: session._id,
		hostId: participantId,
		joinCode: session.joinCode,
	};
}

/** The hosting arguments `hostSession` uses, so both creation flows can be compared. */
export const HOSTED = {
	title: "Game",
	displayName: "Host",
	guestId: "guest_host",
};

export function signedInHost(t: T) {
	return t.withIdentity({ subject: HOST_USER });
}

/**
 * Everything a creation flow left in the database, with the values that differ
 * per session blanked, so a two-step session and a `create` compare equal.
 */
export async function createdRows(
	t: T,
	sessionId: SessionId,
	stateTable: StateTable,
) {
	return await t.run(async (ctx) => {
		const session = await ctx.db.get(sessionId);
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.collect();
		const state = await ctx.db
			.query(stateTable)
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique();
		const rows = JSON.stringify({
			session: { ...fields(session), joinCode: "code", shareToken: "token" },
			participants: participants.map(fields),
			state: fields(state),
		});
		const blanked = participants.reduce(
			(text, { _id }) => text.replaceAll(_id, "participant"),
			rows.replaceAll(sessionId, "session"),
		);
		return JSON.parse(blanked) as unknown;
	});
}

export async function sessionCount(t: T) {
	const sessions = await t.run((ctx) => ctx.db.query("gameSessions").collect());
	return sessions.length;
}

/** The share token a challenge host sends, read the way clients read it. */
export async function shareTokenOf(t: T, sessionId: SessionId) {
	const bundle = await t.query(api.sessions.getBundle, { sessionId });
	const token = bundle?.session.shareToken;
	if (!token) {
		throw new Error("Session has no share token");
	}
	return token;
}

/** A guest following a link. */
export function joinWithToken(
	t: T,
	shareToken: string,
	guestId: string,
	options: { asSpectator?: boolean } = {},
) {
	return t.mutation(api.sessions.joinByToken, {
		shareToken,
		displayName: guestId,
		guestId,
		...options,
	});
}

/** A guest typing a room code. */
export function joinWithCode(
	t: T,
	joinCode: string,
	guestId: string,
	options: { asSpectator?: boolean } = {},
) {
	return t.mutation(api.sessions.joinByCode, {
		joinCode,
		displayName: guestId,
		guestId,
		...options,
	});
}

/** A session of another game, for the wrong-game branch of every loader. */
export async function otherGameSession(t: T, gameType: GameType = "sudoku") {
	const { sessionId } = await hostSession(t, gameType, "solo");
	return sessionId;
}

/** A participant of an unrelated session, for the not-in-this-game branches. */
export async function outsider(t: T) {
	const { hostId } = await hostSession(t, "live-quiz", "solo");
	return hostId;
}

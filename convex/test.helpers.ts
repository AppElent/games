/// <reference types="vite/client" />
/**
 * Shared setup for the characterization suites. The two dots in this file's
 * name keep it out of the Convex deployment, like the `.test.ts` files.
 */
import type { GameErrorCode, GameErrorParams } from "@arcadeclub/core/errors";
import { getFunctionName } from "convex/server";
import { ConvexError, type Value } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { StateTable } from "./lib/gameSession";
import { createHostedSession } from "./lib/hostedSession";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/** The clock every suite starts on, so stored timestamps can be asserted exactly. */
export const T0 = Date.UTC(2026, 0, 1, 12);

type Backend = TestConvex<typeof schema>;
type Args = Record<string, unknown>;
type FunctionRef = Parameters<typeof getFunctionName>[0];

/** The backend behind each `setup()`, with no proof added to its calls. */
const unproven = new WeakMap<object, Backend>();

/**
 * A backend whose `query` and `mutation` calls by function reference go
 * through `rewrite` first, which picks the caller and the arguments.
 */
function intercept(
	backend: Backend,
	rewrite: (fn: FunctionRef, args: Args) => Promise<[Backend, Args]>,
): Backend {
	return new Proxy(backend, {
		get(target, property, receiver) {
			if (property !== "query" && property !== "mutation") {
				return Reflect.get(target, property, receiver);
			}
			return async (fn: unknown, args?: Args) => {
				type Call = (fn: unknown, args?: Args) => Promise<unknown>;
				if (typeof fn === "function" || !args) {
					return await (target[property] as Call)(fn, args);
				}
				const [caller, rewritten] = await rewrite(fn as FunctionRef, args);
				return await (caller[property] as Call)(fn, rewritten);
			};
		},
	});
}

/**
 * A backend whose calls act as the participant their arguments name
 * (`participantId`, or `hostParticipantId`), as that player's own client
 * would: signed in as its account, or sending its guest id. Card games are
 * left alone, since their seat secret is the proof. `impostor(t)` calls with
 * no proof at all.
 */
export function setup() {
	const backend = convexTest(schema, modules);
	const t = intercept(backend, async (fn, args) => {
		const named = args.participantId ?? args.hostParticipantId;
		if (
			typeof named !== "string" ||
			"guestId" in args ||
			getFunctionName(fn).startsWith("cardGames:")
		) {
			return [backend, args];
		}
		// A query, not `run`: reading commits nothing, so the clock stays put.
		const row = await backend.query(async (ctx) => {
			const id = ctx.db.normalizeId("sessionParticipants", named);
			return id ? await ctx.db.get(id) : null;
		});
		if (row?.userId) {
			return [backend.withIdentity({ subject: row.userId }) as Backend, args];
		}
		return [backend, row?.guestId ? { ...args, guestId: row.guestId } : args];
	});
	unproven.set(t, backend);
	return t;
}

export type T = ReturnType<typeof setup>;

/**
 * The same backend calling with no proof: a player naming someone else's
 * public participant id. Add `withIdentity` to sign them in as someone else.
 */
export function impostor(t: T): Backend {
	const backend = unproven.get(t);
	if (!backend) {
		throw new Error("impostor() needs a backend from setup()");
	}
	return backend;
}

/**
 * Everyone who might name a seat that is not theirs: a caller with no proof,
 * a stranger signed in, and the other players in the game, each with their
 * own proof (a guest id, or an account).
 */
export function impostors(
	t: T,
	others: { guestIds?: string[]; userIds?: string[] } = {},
): Backend[] {
	const backend = impostor(t);
	return [
		backend,
		backend.withIdentity({ subject: "user_stranger" }) as Backend,
		...(others.guestIds ?? []).map((guestId) =>
			intercept(backend, async (_fn, args) => [backend, { ...args, guestId }]),
		),
		...(others.userIds ?? []).map(
			(subject) => backend.withIdentity({ subject }) as Backend,
		),
	];
}

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

/**
 * Sends a signed-in player's puzzles to their account through the same
 * `api.sudoku` functions the web uses, and turns an account session into a
 * save the game screens can open.
 *
 * The phone stays the place a move lands: the game screens write the save
 * store at once, and this module sends what the server has not confirmed,
 * one save at a time, oldest first. While the phone is offline the Convex
 * client holds a sent mutation until the connection returns, so a run simply
 * waits; the next run picks up whatever was written meanwhile.
 *
 * `create` is not idempotent on the server, so the phone makes it so: before
 * sending it, the save records when (`createStartedAt`); the answer stores
 * the session id. A run that finds a start time but no id (the app was
 * closed before the answer came back) first looks for that session in the
 * account (same title, created since, same givens) and only creates one when
 * there is none.
 *
 * Each save names the server version its board builds on (`baseUpdatedAt`).
 * When another device has saved a newer board, the server refuses it and the
 * phone takes the server's board instead; a solved board stands. So that a
 * save whose answer got lost is not mistaken for another device's, the link
 * keeps the board being sent until its answer is stored.
 */
import type { SESSION_STATUSES } from "@arcadeclub/core/sessions";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import type { api, Id } from "../../../convex/api";
import {
	adoptGuestSaves,
	type CloudLink,
	findSudokuSaveBySession,
	hasUnsentChanges,
	hideSudokuSession,
	isSudokuSaveOpen,
	listSudokuSaves,
	markSynced,
	readSudokuSave,
	type SudokuSave,
	storeSyncedSave,
	updateCloudLink,
} from "./sudoku-save-store";

type SudokuApi = typeof api.sudoku;
type SessionStatus = (typeof SESSION_STATUSES)[number];
type SessionId = Id<"gameSessions">;

export type CloudBundle = NonNullable<
	FunctionReturnType<SudokuApi["getBundle"]>
>;

/** One of the account's sudoku sessions, as the list query returns it. */
export type AccountSession = {
	sessionId: SessionId;
	title: string;
	status: SessionStatus;
	createdAt: number;
};

/** The account's sudoku sessions from `sessions.listParticipation`. */
export function sudokuSessionsOf(
	rows: {
		session: {
			_id: AccountSession["sessionId"];
			gameType: string;
			title: string;
			status: AccountSession["status"];
			_creationTime: number;
		};
	}[],
): AccountSession[] {
	return rows
		.filter(
			({ session }) =>
				session.gameType === "sudoku" && session.status !== "cancelled",
		)
		.map(({ session }) => ({
			sessionId: session._id,
			title: session.title,
			status: session.status,
			createdAt: session._creationTime,
		}));
}

/** The server calls a run makes; the hook binds them to the Convex client. */
export type SudokuCloud = {
	create(
		args: FunctionArgs<SudokuApi["create"]>,
	): Promise<{ sessionId: SessionId; updatedAt: number }>;
	saveProgress(
		args: FunctionArgs<SudokuApi["saveProgress"]>,
	): Promise<FunctionReturnType<SudokuApi["saveProgress"]>>;
	setPaused(args: FunctionArgs<SudokuApi["setPaused"]>): Promise<unknown>;
	complete(args: FunctionArgs<SudokuApi["complete"]>): Promise<unknown>;
	listSessions(): Promise<AccountSession[]>;
	getBundle(sessionId: SessionId): Promise<CloudBundle | null>;
};

export type SyncAccount = {
	userId: string;
	displayName: string;
	/** The title a new session gets. */
	titleOf(save: SudokuSave): string;
	/** False once the player signed out or switched accounts mid-run. */
	isCurrent(): boolean;
};

/** How far the phone's clock may run ahead of the server's. */
const CLOCK_SKEW_MS = 10 * 60_000;
/** The server's answer when a session no longer exists. */
const GONE = new Set(["gameNotFound", "sessionNotFound"]);

const asSessionId = (id: string) => id as SessionId;

function givensOf(save: SudokuSave) {
	return save.variant === "binary" ? save.givens : save.board.givens;
}

function digitsOf(save: SudokuSave) {
	return save.variant === "binary" ? save.entries : save.board.digits;
}

/**
 * The puzzle as `sudoku.create` stores it. The player's digits go with the
 * first progress save instead: `create` rejects a grid with a conflict, and
 * a player's wrong digit must not keep a puzzle off their account.
 */
export function createArgs(
	save: SudokuSave,
	title: string,
	displayName: string,
): FunctionArgs<SudokuApi["create"]> {
	const common = {
		title,
		displayName,
		source: save.source ?? ("generated" as const),
		difficulty: save.difficulty,
	};
	if (save.variant === "binary") {
		return {
			...common,
			variant: "binary",
			size: save.size,
			givens: save.givens,
		};
	}
	return {
		...common,
		// Classic stays unnamed, like every classic session the web stores.
		...(save.variant === "killer"
			? { variant: "killer" as const, cages: save.cages }
			: {}),
		givens: save.board.givens,
		solution: save.solution,
		autoCleanup: save.autoCleanup,
	};
}

/** The board, notes and clock as `sudoku.saveProgress` stores them. */
export function progressArgs(
	sessionId: SessionId,
	save: SudokuSave,
): FunctionArgs<SudokuApi["saveProgress"]> {
	if (save.variant === "binary") {
		const empty = new Array<number>(save.size * save.size).fill(0);
		return {
			sessionId,
			digits: save.entries,
			cornerNotes: empty,
			centerNotes: empty,
			colors: empty,
			elapsedSeconds: save.elapsedSeconds,
		};
	}
	return {
		sessionId,
		digits: save.board.digits,
		cornerNotes: save.board.corner,
		centerNotes: save.board.center,
		colors: save.board.colors,
		elapsedSeconds: save.elapsedSeconds,
		autoCleanup: save.autoCleanup,
	};
}

/**
 * An account session as a save on this phone. The clock folds in the time
 * the session has run since it was last resumed, as the web does. The server
 * never sends a puzzle's source or solution, so a `local` copy of the same
 * puzzle lends its own.
 */
export function saveFromBundle(
	bundle: CloudBundle,
	{
		id,
		userId,
		now,
		local,
	}: { id: string; userId: string; now: number; local?: SudokuSave },
): SudokuSave {
	const { session, state } = bundle;
	const running =
		state.status === "active" && state.lastResumedAt
			? Math.max(0, Math.round((now - state.lastResumedAt) / 1000))
			: 0;
	const base = {
		id,
		difficulty: state.difficulty,
		updatedAt: state.updatedAt,
		elapsedSeconds: state.elapsedSeconds + running,
		status: state.status === "completed" ? "completed" : "active",
		cloud: {
			userId,
			sessionId: session._id,
			synced: true,
			title: session.title,
			baseUpdatedAt: state.updatedAt,
			loadedUpdatedAt: state.updatedAt,
		},
	} as const;
	if (state.variant === "binary") {
		return {
			...base,
			variant: "binary",
			size: state.size ?? 0,
			givens: state.givens,
			entries: state.digits,
		};
	}
	return {
		...base,
		variant: state.variant === "killer" ? "killer" : "classic",
		...(local &&
			local.variant !== "binary" && {
				source: local.source,
				solution: local.solution,
			}),
		board: {
			givens: state.givens,
			digits: state.digits,
			corner: state.cornerNotes,
			center: state.centerNotes,
			colors: state.colors,
		},
		cages: state.cages,
		autoCleanup: state.autoCleanup,
	};
}

/** A board as `CloudLink.sending` holds it. */
function boardKey(
	board: Pick<
		CloudBundle["state"],
		"digits" | "cornerNotes" | "centerNotes" | "colors"
	>,
) {
	const { digits, cornerNotes, centerNotes, colors } = board;
	return JSON.stringify([digits, cornerNotes, centerNotes, colors]);
}

function errorCode(error: unknown) {
	if (!(error instanceof ConvexError)) return undefined;
	const data = error.data as { code?: unknown } | null;
	return typeof data?.code === "string" ? data.code : undefined;
}

/** Stops a run whose account is no longer the one signed in. */
class AccountChanged extends Error {}

/**
 * One pass over `account`'s unsent saves. A save that fails stays unsent and
 * is reported to `onError`; the next run tries it again. Guest saves on the
 * phone become the account's first, so they upload once.
 */
export async function syncSudokuSaves(
	account: SyncAccount,
	cloud: SudokuCloud,
	{
		now = Date.now,
		onError = () => {},
	}: { now?: () => number; onError?: (error: unknown) => void } = {},
) {
	adoptGuestSaves(account.userId);
	const guard = () => {
		if (!account.isCurrent()) throw new AccountChanged();
	};
	let sessions: Promise<AccountSession[]> | undefined;
	const accountSessions = () => {
		sessions ??= cloud.listSessions();
		return sessions;
	};

	/**
	 * The session a create with no answer made, if it reached the server, with
	 * the version it was created at: the phone has saved nothing to it yet.
	 */
	async function findCreated(save: SudokuSave, link: CloudLink) {
		if (link.createStartedAt === undefined) return undefined;
		const since = link.createStartedAt - CLOCK_SKEW_MS;
		for (const candidate of await accountSessions()) {
			if (candidate.createdAt < since || candidate.title !== link.title) {
				continue;
			}
			if (findSudokuSaveBySession(candidate.sessionId)) continue;
			guard();
			const bundle = await cloud.getBundle(candidate.sessionId);
			if (bundle && bundle.state.givens === givensOf(save)) {
				return {
					sessionId: candidate.sessionId,
					updatedAt: bundle.state.createdAt,
				};
			}
		}
		return undefined;
	}

	async function ensureSession(save: SudokuSave, link: CloudLink) {
		if (link.sessionId) return asSessionId(link.sessionId);
		let session = await findCreated(save, link);
		if (!session) {
			const title = link.title ?? account.titleOf(save);
			updateCloudLink(save.id, (current) => ({
				...current,
				title,
				createStartedAt: now(),
			}));
			guard();
			session = await cloud.create(
				createArgs(save, title, account.displayName),
			);
		}
		const { sessionId, updatedAt } = session;
		// The Convex client resends a held create under whoever is signed in
		// when it reconnects, so after an account change the answer may not be
		// this account's session. The save stays unlinked with its start time;
		// the owner's next run finds the session in their account or makes one.
		guard();
		const linked = updateCloudLink(save.id, (current) => ({
			...current,
			sessionId,
			createStartedAt: undefined,
			baseUpdatedAt: updatedAt,
		}));
		// Deleted while the create was on its way: keep it off the list.
		if (!linked) hideSudokuSession(sessionId);
		return linked ? sessionId : undefined;
	}

	/**
	 * Settles a save whose answer never came back: when the server holds
	 * exactly that board, it arrived, and the phone's board builds on it.
	 */
	async function settleUnanswered(id: string, sessionId: SessionId) {
		const sending = readSudokuSave(id)?.cloud?.sending;
		if (sending === undefined) return;
		guard();
		const bundle = await cloud.getBundle(sessionId);
		guard();
		const arrived = bundle !== null && boardKey(bundle.state) === sending;
		updateCloudLink(id, (current) => ({
			...current,
			baseUpdatedAt: arrived ? bundle.state.updatedAt : current.baseUpdatedAt,
			sending: undefined,
		}));
	}

	/** Replaces the phone's stale copy with the account's newer board. */
	async function takeServerBoard(id: string, sessionId: SessionId) {
		guard();
		const bundle = await cloud.getBundle(sessionId);
		guard();
		const local = readSudokuSave(id);
		// Gone from either side: nothing to replace, or the next run finds out.
		if (!bundle || !local) return;
		// Solved meanwhile: the board stands, and the next run completes it.
		if (local.status === "completed") return;
		storeSyncedSave(
			saveFromBundle(bundle, {
				id,
				userId: account.userId,
				now: now(),
				local,
			}),
		);
	}

	async function send(id: string) {
		const save = readSudokuSave(id);
		if (!save?.cloud || save.cloud.synced) return;
		if (save.cloud.userId !== account.userId) return;
		const sessionId = await ensureSession(save, save.cloud);
		if (!sessionId) return;
		await settleUnanswered(id, sessionId);
		// What was written while the session was being created goes too.
		const latest = readSudokuSave(id);
		if (!latest) return;
		guard();
		const progress = progressArgs(sessionId, latest);
		updateCloudLink(id, (current) => ({
			...current,
			sending: boardKey(progress),
		}));
		const { saved, updatedAt } = await cloud.saveProgress({
			...progress,
			baseUpdatedAt: latest.cloud?.baseUpdatedAt,
		});
		updateCloudLink(id, (current) => ({
			...current,
			baseUpdatedAt: saved ? updatedAt : current.baseUpdatedAt,
			sending: undefined,
		}));
		if (!saved && latest.status !== "completed") {
			return takeServerBoard(id, sessionId);
		}
		if (latest.status === "completed") {
			await cloud.complete({
				sessionId,
				digits: digitsOf(latest),
				elapsedSeconds: latest.elapsedSeconds,
			});
		} else {
			// Nobody plays it on the server between the phone's saves, so its
			// clock stays stopped there; the web resumes it when opened. While
			// the phone plays it, the session runs on: the same puzzle may be
			// played on the web, and pausing would stop that clock. The phone
			// pauses it once it leaves the puzzle (its last write comes after).
			const playingHere = isSudokuSaveOpen(id) && latest.status === "active";
			if (!playingHere) await cloud.setPaused({ sessionId, paused: true });
		}
		markSynced(id, latest.updatedAt);
	}

	const pending = listSudokuSaves(account.userId)
		.filter(hasUnsentChanges)
		.sort((a, b) => a.updatedAt - b.updatedAt);
	for (const item of pending) {
		try {
			await send(item.id);
		} catch (error) {
			if (error instanceof AccountChanged) return;
			if (GONE.has(errorCode(error) ?? "")) {
				// The session is gone from the server; the phone's copy makes a
				// new one on the next run rather than losing the puzzle.
				updateCloudLink(item.id, (link) => ({
					...link,
					sessionId: undefined,
					synced: false,
					baseUpdatedAt: undefined,
					sending: undefined,
				}));
			}
			onError(error);
		}
	}
}

/**
 * Runs `run` at most once at a time. A request while it runs queues exactly
 * one more run, so writes made during a run are sent right after it.
 */
export function createSyncRunner(run: () => Promise<void>) {
	let running = false;
	let again = false;
	async function loop() {
		running = true;
		try {
			do {
				again = false;
				await run();
			} while (again);
		} finally {
			running = false;
		}
	}
	return {
		request() {
			if (running) {
				again = true;
				return Promise.resolve();
			}
			return loop();
		},
	};
}

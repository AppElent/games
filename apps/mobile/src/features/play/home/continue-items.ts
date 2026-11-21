/**
 * Everything this phone can resume, newest first. Each game decides what it
 * offers and how removing it works; the Play tab only lists what comes back.
 */
import type { GameType } from "@arcadeclub/core/games";
import type { Href } from "expo-router";
import {
	readJson,
	STORAGE_KEYS,
	writeJson,
} from "../../../storage/local-store";
import { resumableItems as resumableMatch } from "../../backgammon/local/local-match-store";
import {
	forgetSeat,
	resumableItems as resumableSeats,
	type Seat,
} from "../../sessions/session-seats";
import { resumableItems as resumablePuzzles } from "../../sudoku/saves/sudoku-save-store";
import {
	type AppGameType,
	isOnlineAppGame,
	onlineSessionHref,
} from "../app-games";

export type ContinueItem = {
	id: string;
	gameType: AppGameType;
	href: Href;
	updatedAt: number;
	remove: () => void;
	/** This phone's seat when the game is online; saved games have none. */
	seat?: Seat;
};

/** An open game of the signed-in account, as `sessions.listParticipation` has it. */
export type AccountSession = Seat & {
	gameType: GameType;
	createdAt: number;
};

/** The account's lobbies and running games that this app can open. */
export function accountSessionsOf(
	rows: {
		session: {
			_id: AccountSession["sessionId"];
			gameType: GameType;
			status: string;
			_creationTime: number;
		};
		participant: { _id: AccountSession["participantId"] };
	}[],
): AccountSession[] {
	return rows
		.filter(
			({ session }) =>
				(session.status === "lobby" || session.status === "active") &&
				isOnlineAppGame(session.gameType),
		)
		.map(({ session, participant }) => ({
			sessionId: session._id,
			participantId: participant._id,
			gameType: session.gameType,
			createdAt: session._creationTime,
		}));
}

/** Removed account games remembered; older ones may come back to the list. */
const HIDDEN_LIMIT = 200;

/** How many account games are looked up for their live state at once. */
const ACCOUNT_LIMIT = 20;

function hiddenSessions(): string[] {
	return (
		readJson(STORAGE_KEYS.continueHidden, (value) =>
			Array.isArray(value)
				? value.filter((item) => typeof item === "string")
				: null,
		) ?? []
	);
}

function hideSession(sessionId: string) {
	const rest = hiddenSessions().filter((item) => item !== sessionId);
	writeJson(
		STORAGE_KEYS.continueHidden,
		[sessionId, ...rest].slice(0, HIDDEN_LIMIT),
	);
}

/**
 * Open games of the account that this phone holds no seat for, so a game
 * started on another device shows up too. Removing one only hides it here.
 */
function accountItems(
	account: AccountSession[],
	held: ReadonlySet<string>,
): ContinueItem[] {
	const hidden = new Set(hiddenSessions());
	return account
		.flatMap(({ sessionId, participantId, gameType, createdAt }) => {
			if (held.has(sessionId) || hidden.has(sessionId)) return [];
			if (!isOnlineAppGame(gameType)) return [];
			return [
				{
					id: `online:${sessionId}`,
					gameType,
					href: onlineSessionHref(gameType, sessionId),
					updatedAt: createdAt,
					seat: { sessionId, participantId },
					remove: () => hideSession(sessionId),
				},
			];
		})
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, ACCOUNT_LIMIT);
}

/**
 * Newest first. Online items may still turn out finished; see
 * `online-status`. `owner` is the signed-in player (null for a guest), whose
 * puzzles the phone offers; `account` is their open games from any device
 * (empty for a guest, who only has this phone's seats).
 */
export function listContinueItems(
	now = Date.now(),
	owner: string | null = null,
	account: AccountSession[] = [],
): ContinueItem[] {
	const seats = resumableSeats(now).map((item) => ({
		...item,
		// The account would list a removed seat again, so hide it there too.
		remove: () => {
			forgetSeat(item.seat.sessionId);
			hideSession(item.seat.sessionId);
		},
	}));
	const held = new Set(seats.map((item) => item.seat.sessionId));
	return [
		...resumablePuzzles(owner),
		...resumableMatch(),
		...seats,
		...(owner ? accountItems(account, held) : []),
	].sort((a, b) => b.updatedAt - a.updatedAt);
}

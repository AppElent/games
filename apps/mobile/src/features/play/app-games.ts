/**
 * The games this app carries, in Play-tab order: exactly the games that
 * `@arcadeclub/core/features` lists on `mobile` (`app-games.test.ts` checks
 * it), so a game moves to the app in both places. This file holds only the
 * app's wiring. Text comes from the shared catalog under each game's id. An
 * online game names the `create` mutation the app hosts through and the
 * screen a seated player opens.
 */
import type { GameType } from "@arcadeclub/core/games";
import type { Href } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { api } from "../../convex/api";
import type { Tokens } from "../../theme";
import type { Icon } from "../../ui/icon";

type AppGame<G extends GameType = GameType> = {
	id: G;
	href: Href;
	icon: SFSymbol;
	androidIcon: Parameters<typeof Icon>[0]["android"];
	tint: keyof Tokens;
	tintDim: keyof Tokens;
	/** One entry opens several games, so Continue shows the session's own title. */
	titledBySession?: true;
	online?: {
		create: unknown;
		sessionHref: (sessionId: string) => Href;
	};
};

export const APP_GAMES = {
	sudoku: {
		id: "sudoku",
		href: "/sudoku",
		icon: "square.grid.3x3.fill",
		androidIcon: "grid_on",
		tint: "accent",
		tintDim: "accentDim",
	},
	backgammon: {
		id: "backgammon",
		href: "/backgammon",
		icon: "dice.fill",
		androidIcon: "casino",
		tint: "orange",
		tintDim: "orangeDim",
		online: {
			create: api.backgammon.create,
			sessionHref: (sessionId: string) => ({
				pathname: "/backgammon/online/[sessionId]",
				params: { sessionId },
			}),
		},
	},
	hitster: {
		id: "hitster",
		href: "/hitster",
		icon: "music.note.list",
		androidIcon: "queue_music",
		tint: "pink",
		tintDim: "pinkDim",
		online: {
			create: api.hitster.create,
			sessionHref: (sessionId: string) => ({
				pathname: "/hitster/[sessionId]",
				params: { sessionId },
			}),
		},
	},
	"beat-the-clock": {
		id: "beat-the-clock",
		href: "/beat-the-clock",
		icon: "timer",
		androidIcon: "timer",
		tint: "amber",
		tintDim: "amberDim",
		online: {
			create: api.beatTheClock.create,
			sessionHref: (sessionId: string) => ({
				pathname: "/beat-the-clock/[sessionId]",
				params: { sessionId },
			}),
		},
	},
	"card-games": {
		id: "card-games",
		href: "/cards",
		icon: "suit.spade.fill",
		androidIcon: "playing_cards",
		tint: "green",
		tintDim: "greenDim",
		titledBySession: true,
		online: {
			create: api.cardGames.createTable,
			sessionHref: (sessionId: string) => ({
				pathname: "/cards/table/[sessionId]",
				params: { sessionId },
			}),
		},
	},
	"dice-games": {
		id: "dice-games",
		href: "/dice",
		icon: "die.face.5.fill",
		androidIcon: "ifl",
		tint: "orange",
		tintDim: "orangeDim",
		titledBySession: true,
		online: {
			create: api.diceGames.createTable,
			sessionHref: (sessionId: string) => ({
				pathname: "/dice/table/[sessionId]",
				params: { sessionId },
			}),
		},
	},
} as const satisfies { [G in GameType]?: AppGame<G> };

export type AppGameType = keyof typeof APP_GAMES;

/** A game this app plays online, hosting through its own `create`. */
export type OnlineGameType = {
	[G in AppGameType]: (typeof APP_GAMES)[G] extends { online: object }
		? G
		: never;
}[AppGameType];

const BY_TYPE: { [G in GameType]?: AppGame } = APP_GAMES;

/** Whether this app hosts and opens sessions of this game. */
export function isOnlineAppGame(
	gameType: GameType,
): gameType is OnlineGameType {
	return Boolean(BY_TYPE[gameType]?.online);
}

/** The in-app screen for an online session. */
export function onlineSessionHref(
	gameType: OnlineGameType,
	sessionId: string,
): Href {
	return APP_GAMES[gameType].online.sessionHref(sessionId);
}

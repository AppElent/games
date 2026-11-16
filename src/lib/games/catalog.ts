import {
	GAME_TYPES,
	type GameType,
	type SessionGameType,
} from "@arcadeclub/core/games";
import type { Messages } from "@arcadeclub/core/messages";
import {
	Brain,
	CircleDot,
	Dice5,
	Dices,
	Grid3X3,
	Music,
	Spade,
	Swords,
	Trophy,
	Users,
} from "lucide-react";
import type { ComponentType } from "react";

type SessionPath = (sessionId: string, participantId: string) => string;

type GameCatalogItem = {
	readonly type: GameType;
	readonly accent: "cyan" | "green" | "pink" | "orange" | "amber" | "violet";
	readonly icon: ComponentType<{ className?: string }>;
	readonly route: string;
	/** Where a seated player plays. `null`: this game has no sessions to join. */
	readonly sessionPath: SessionPath | null;
	/** Where the host runs the game, when that differs from `sessionPath`. */
	readonly hostPath?: (sessionId: string) => string;
};

export type LocalizedGame = GameCatalogItem & Messages["catalog"][GameType];

/** `sessionPath` is set exactly for the games core says have sessions. */
type CatalogEntries = {
	readonly [G in GameType]: Omit<GameCatalogItem, "type" | "sessionPath"> & {
		readonly sessionPath: G extends SessionGameType ? SessionPath : null;
	};
};

/** A new game in `GAME_TYPES` fails to compile here until it has an entry. */
const GAME_CATALOG: CatalogEntries = {
	"live-quiz": {
		accent: "green",
		icon: Trophy,
		route: "/quiz/new",
		sessionPath: (sessionId, participantId) =>
			`/quiz/${sessionId}/play?participantId=${participantId}`,
		hostPath: (sessionId) => `/quiz/${sessionId}/host`,
	},
	backgammon: {
		accent: "pink",
		icon: Dices,
		route: "/backgammon/new",
		sessionPath: (sessionId) => `/backgammon/${sessionId}`,
	},
	sudoku: {
		accent: "cyan",
		icon: Grid3X3,
		route: "/sudoku/new",
		sessionPath: (sessionId) => `/sudoku/${sessionId}`,
	},
	chess: {
		accent: "violet",
		icon: Brain,
		route: "/chess/new",
		sessionPath: (sessionId) => `/chess/${sessionId}`,
	},
	hitster: {
		accent: "pink",
		icon: Music,
		route: "/hitster/new",
		sessionPath: (sessionId, participantId) =>
			`/hitster/${sessionId}/play?participantId=${participantId}`,
		hostPath: (sessionId) => `/hitster/${sessionId}/host`,
	},
	"word-links": {
		accent: "green",
		icon: CircleDot,
		route: "/word-links",
		sessionPath: null,
	},
	"connect-four": {
		accent: "amber",
		icon: CircleDot,
		route: "/connect-four/new",
		sessionPath: (sessionId) => `/connect-four/${sessionId}`,
	},
	"signal-words": {
		accent: "pink",
		icon: Users,
		route: "/signal-words/new",
		sessionPath: (sessionId) => `/signal-words/${sessionId}`,
	},
	"bluff-dice": {
		accent: "orange",
		icon: Dices,
		route: "/dice/liars-dice",
		sessionPath: (sessionId) => `/bluff-dice/${sessionId}`,
	},
	"squad-surge": {
		accent: "orange",
		icon: Swords,
		route: "/squad-surge",
		sessionPath: null,
	},
	"card-games": {
		accent: "pink",
		icon: Spade,
		route: "/cards",
		sessionPath: (sessionId) => `/cards/table/${sessionId}`,
	},
	"dice-games": {
		accent: "amber",
		icon: Dice5,
		route: "/dice",
		sessionPath: (sessionId) => `/dice/table/${sessionId}`,
	},
};

/**
 * Games that keep their sessions but no longer get a tile. Bluff Dice plays on
 * as liar's dice among the dice games; its old rooms still open here.
 */
const UNLISTED: ReadonlySet<GameType> = new Set(["bluff-dice"]);

const VISIBLE_GAMES: readonly GameCatalogItem[] = GAME_TYPES.filter(
	(type) => !UNLISTED.has(type),
).map((type) => ({ type, ...GAME_CATALOG[type] }));

export function getVisibleGames() {
	return VISIBLE_GAMES;
}

export function getGameRoute(type: GameType) {
	return GAME_CATALOG[type].route;
}

/** Where a joined player goes; `null` for a game with no sessions. */
export function getSessionPath(
	type: GameType,
	sessionId: string,
	participantId: string,
) {
	return GAME_CATALOG[type].sessionPath?.(sessionId, participantId) ?? null;
}

/** Where a game's host goes after creating it. */
export function getHostPath(
	type: GameType,
	sessionId: string,
	participantId: string,
) {
	const { hostPath } = GAME_CATALOG[type];
	return hostPath
		? hostPath(sessionId)
		: getSessionPath(type, sessionId, participantId);
}

/** A catalog item with its display text in the viewer's language. */
export function getLocalizedGame(
	game: GameCatalogItem,
	messages: Pick<Messages, "catalog">,
): LocalizedGame {
	return { ...game, ...messages.catalog[game.type] };
}

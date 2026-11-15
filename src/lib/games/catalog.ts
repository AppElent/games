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
	readonly accent: string;
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
		accent: "from-emerald-400 to-cyan-300",
		icon: Trophy,
		route: "/quiz/new",
		sessionPath: (sessionId, participantId) =>
			`/quiz/${sessionId}/play?participantId=${participantId}`,
		hostPath: (sessionId) => `/quiz/${sessionId}/host`,
	},
	backgammon: {
		accent: "from-fuchsia-400 to-orange-300",
		icon: Dices,
		route: "/backgammon/new",
		sessionPath: (sessionId) => `/backgammon/${sessionId}`,
	},
	sudoku: {
		accent: "from-sky-400 to-blue-500",
		icon: Grid3X3,
		route: "/sudoku/new",
		sessionPath: (sessionId) => `/sudoku/${sessionId}`,
	},
	chess: {
		accent: "from-violet-400 to-indigo-400",
		icon: Brain,
		route: "/chess/new",
		sessionPath: (sessionId) => `/chess/${sessionId}`,
	},
	hitster: {
		accent: "from-pink-400 to-rose-300",
		icon: Music,
		route: "/hitster/new",
		sessionPath: (sessionId, participantId) =>
			`/hitster/${sessionId}/play?participantId=${participantId}`,
		hostPath: (sessionId) => `/hitster/${sessionId}/host`,
	},
	"word-links": {
		accent: "from-lime-300 to-emerald-400",
		icon: CircleDot,
		route: "/word-links",
		sessionPath: null,
	},
	"connect-four": {
		accent: "from-amber-300 to-red-400",
		icon: CircleDot,
		route: "/connect-four/new",
		sessionPath: (sessionId) => `/connect-four/${sessionId}`,
	},
	"signal-words": {
		accent: "from-rose-400 to-sky-400",
		icon: Users,
		route: "/signal-words/new",
		sessionPath: (sessionId) => `/signal-words/${sessionId}`,
	},
	"bluff-dice": {
		accent: "from-orange-300 to-rose-400",
		icon: Dices,
		route: "/dice/liars-dice",
		sessionPath: (sessionId) => `/bluff-dice/${sessionId}`,
	},
	"squad-surge": {
		accent: "from-red-500 to-orange-400",
		icon: Swords,
		route: "/squad-surge",
		sessionPath: null,
	},
	"card-games": {
		accent: "from-rose-400 to-emerald-400",
		icon: Spade,
		route: "/cards",
		sessionPath: (sessionId) => `/cards/table/${sessionId}`,
	},
	"dice-games": {
		accent: "from-amber-300 to-emerald-400",
		icon: Dice5,
		route: "/dice",
		sessionPath: (sessionId) => `/dice/table/${sessionId}`,
	},
};

/**
 * Games that keep their sessions but no longer get a tile. Bluff Dice plays on
 * as liar's dice among the dice games; its type goes once the migration that
 * moves its sessions has run (see `convex/migrations.ts`).
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

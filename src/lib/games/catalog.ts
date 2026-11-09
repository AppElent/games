import {
	type AuthPolicy,
	GAME_TYPES,
	type GameType,
	type JoinMode,
} from "@arcadeclub/core/games";
import type { Messages } from "@arcadeclub/core/messages";
import {
	Brain,
	CircleDot,
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
	readonly joinMode: JoinMode;
	readonly authPolicy: AuthPolicy;
	readonly accent: string;
	readonly icon: ComponentType<{ className?: string }>;
	readonly route: string;
	/** Where a seated player plays. `null`: this game has no sessions to join. */
	readonly sessionPath: SessionPath | null;
	/** Where the host runs the game, when that differs from `sessionPath`. */
	readonly hostPath?: (sessionId: string) => string;
};

export type LocalizedGame = GameCatalogItem & Messages["catalog"][GameType];

/** A new game in `GAME_TYPES` fails to compile here until it has an entry. */
const GAME_CATALOG: Record<GameType, Omit<GameCatalogItem, "type">> = {
	"live-quiz": {
		joinMode: "room",
		authPolicy: "hostChoice",
		accent: "from-emerald-400 to-cyan-300",
		icon: Trophy,
		route: "/quiz/new",
		sessionPath: (sessionId, participantId) =>
			`/quiz/${sessionId}/play?participantId=${participantId}`,
		hostPath: (sessionId) => `/quiz/${sessionId}/host`,
	},
	backgammon: {
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		accent: "from-fuchsia-400 to-orange-300",
		icon: Dices,
		route: "/backgammon/new",
		sessionPath: (sessionId) => `/backgammon/${sessionId}`,
	},
	sudoku: {
		joinMode: "solo",
		authPolicy: "guestAllowed",
		accent: "from-sky-400 to-blue-500",
		icon: Grid3X3,
		route: "/sudoku/new",
		sessionPath: (sessionId) => `/sudoku/${sessionId}`,
	},
	chess: {
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		accent: "from-violet-400 to-indigo-400",
		icon: Brain,
		route: "/chess/new",
		sessionPath: (sessionId) => `/chess/${sessionId}`,
	},
	hitster: {
		joinMode: "room",
		authPolicy: "hostChoice",
		accent: "from-pink-400 to-rose-300",
		icon: Music,
		route: "/hitster/new",
		sessionPath: (sessionId, participantId) =>
			`/hitster/${sessionId}/play?participantId=${participantId}`,
		hostPath: (sessionId) => `/hitster/${sessionId}/host`,
	},
	"word-links": {
		joinMode: "solo",
		authPolicy: "guestAllowed",
		accent: "from-lime-300 to-emerald-400",
		icon: CircleDot,
		route: "/word-links",
		sessionPath: null,
	},
	"connect-four": {
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		accent: "from-amber-300 to-red-400",
		icon: CircleDot,
		route: "/connect-four/new",
		sessionPath: (sessionId) => `/connect-four/${sessionId}`,
	},
	"signal-words": {
		joinMode: "room",
		authPolicy: "guestAllowed",
		accent: "from-rose-400 to-sky-400",
		icon: Users,
		route: "/signal-words/new",
		sessionPath: (sessionId) => `/signal-words/${sessionId}`,
	},
	"bluff-dice": {
		joinMode: "room",
		authPolicy: "guestAllowed",
		accent: "from-orange-300 to-rose-400",
		icon: Dices,
		route: "/bluff-dice/new",
		sessionPath: (sessionId) => `/bluff-dice/${sessionId}`,
	},
	"squad-surge": {
		joinMode: "solo",
		authPolicy: "guestAllowed",
		accent: "from-red-500 to-orange-400",
		icon: Swords,
		route: "/squad-surge",
		sessionPath: null,
	},
	"card-games": {
		joinMode: "room",
		authPolicy: "guestAllowed",
		accent: "from-rose-400 to-emerald-400",
		icon: Spade,
		route: "/cards",
		sessionPath: (sessionId) => `/cards/table/${sessionId}`,
	},
};

const VISIBLE_GAMES: readonly GameCatalogItem[] = GAME_TYPES.map((type) => ({
	type,
	...GAME_CATALOG[type],
}));

export function getVisibleGames() {
	return VISIBLE_GAMES;
}

export function getGameByType(type: GameType) {
	return VISIBLE_GAMES.find((item) => item.type === type);
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

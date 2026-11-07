import type { AuthPolicy, GameType, JoinMode } from "@arcadeclub/core/games";
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

export type { AuthPolicy, GameType, JoinMode };

type GameCatalogItem = {
	readonly type: GameType;
	readonly joinMode: JoinMode;
	readonly authPolicy: AuthPolicy;
	readonly accent: string;
	readonly icon: ComponentType<{ className?: string }>;
	readonly route: string;
};

export type LocalizedGame = GameCatalogItem & Messages["catalog"][GameType];

const GAME_CATALOG: readonly GameCatalogItem[] = [
	{
		type: "live-quiz",
		joinMode: "room",
		authPolicy: "hostChoice",
		accent: "from-emerald-400 to-cyan-300",
		icon: Trophy,
		route: "/quiz/new",
	},
	{
		type: "backgammon",
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		accent: "from-fuchsia-400 to-orange-300",
		icon: Dices,
		route: "/backgammon/new",
	},
	{
		type: "sudoku",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		accent: "from-sky-400 to-blue-500",
		icon: Grid3X3,
		route: "/sudoku/new",
	},
	{
		type: "chess",
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		accent: "from-violet-400 to-indigo-400",
		icon: Brain,
		route: "/chess/new",
	},
	{
		type: "hitster",
		joinMode: "room",
		authPolicy: "hostChoice",
		accent: "from-pink-400 to-rose-300",
		icon: Music,
		route: "/hitster/new",
	},
	{
		type: "word-links",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		accent: "from-lime-300 to-emerald-400",
		icon: CircleDot,
		route: "/word-links",
	},
	{
		type: "connect-four",
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		accent: "from-amber-300 to-red-400",
		icon: CircleDot,
		route: "/connect-four/new",
	},
	{
		type: "signal-words",
		joinMode: "room",
		authPolicy: "guestAllowed",
		accent: "from-rose-400 to-sky-400",
		icon: Users,
		route: "/signal-words/new",
	},
	{
		type: "bluff-dice",
		joinMode: "room",
		authPolicy: "guestAllowed",
		accent: "from-orange-300 to-rose-400",
		icon: Dices,
		route: "/bluff-dice/new",
	},
	{
		type: "squad-surge",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		accent: "from-red-500 to-orange-400",
		icon: Swords,
		route: "/squad-surge",
	},
	{
		type: "card-games",
		joinMode: "room",
		authPolicy: "guestAllowed",
		accent: "from-rose-400 to-emerald-400",
		icon: Spade,
		route: "/cards",
	},
];

export function getVisibleGames() {
	return GAME_CATALOG;
}

export function getGameByType(type: GameType) {
	return GAME_CATALOG.find((item) => item.type === type);
}

/** A catalog item with its display text in the viewer's language. */
export function getLocalizedGame(
	game: GameCatalogItem,
	messages: Pick<Messages, "catalog">,
): LocalizedGame {
	return { ...game, ...messages.catalog[game.type] };
}

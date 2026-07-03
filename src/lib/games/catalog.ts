import {
	Brain,
	ChartNoAxesColumnIncreasing,
	CircleDot,
	Dices,
	Gamepad2,
	Grid3X3,
	Music,
	Trophy,
} from "lucide-react";
import type { ComponentType } from "react";

export type GameType =
	| "live-quiz"
	| "backgammon"
	| "sudoku"
	| "chess"
	| "hitster"
	| "word-games";

export type JoinMode = "room" | "challenge" | "solo";
export type AuthPolicy = "guestAllowed" | "signedInRequired" | "hostChoice";
export type GameAvailability = "playable" | "coming-soon";

export type GameCatalogItem = {
	readonly type: GameType;
	readonly title: string;
	readonly tagline: string;
	readonly description: string;
	readonly joinMode: JoinMode;
	readonly authPolicy: AuthPolicy;
	readonly availability: GameAvailability;
	readonly accent: string;
	readonly icon: ComponentType<{ className?: string }>;
	readonly primaryAction: string;
	readonly route: string;
	readonly stats: string;
};

const GAME_CATALOG_ITEMS = [
	{
		type: "live-quiz",
		title: "Live Quiz",
		tagline: "Host-led quiz nights",
		description:
			"Run a room, show questions on the big screen, and let everyone answer from their own device.",
		joinMode: "room",
		authPolicy: "hostChoice",
		availability: "playable",
		accent: "from-emerald-400 to-cyan-300",
		icon: Trophy,
		primaryAction: "Host quiz",
		route: "/quiz/new",
		stats: "Room code",
	},
	{
		type: "backgammon",
		title: "Backgammon",
		tagline: "Two-player challenge",
		description:
			"Start a board, share a link or QR code, and let your opponent claim the second seat.",
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		availability: "playable",
		accent: "from-fuchsia-400 to-orange-300",
		icon: Dices,
		primaryAction: "Start match",
		route: "/backgammon/new",
		stats: "Share link",
	},
	{
		type: "sudoku",
		title: "Sudoku",
		tagline: "Solo puzzle sessions",
		description:
			"Generate puzzles at four difficulties, annotate with pro notation, or scan a paper puzzle and keep solving digitally.",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		availability: "playable",
		accent: "from-sky-400 to-blue-500",
		icon: Grid3X3,
		primaryAction: "Play sudoku",
		route: "/sudoku/new",
		stats: "Solo",
	},
	{
		type: "chess",
		title: "Chess",
		tagline: "Direct board duels",
		description: "Share a challenge link and play a clean real-time match.",
		joinMode: "challenge",
		authPolicy: "guestAllowed",
		availability: "coming-soon",
		accent: "from-violet-400 to-indigo-400",
		icon: Brain,
		primaryAction: "Preview",
		route: "/games/chess",
		stats: "2 players",
	},
	{
		type: "hitster",
		title: "Hitster",
		tagline: "Music timeline party",
		description:
			"Host a music round and place songs on a shared timeline with friends.",
		joinMode: "room",
		authPolicy: "hostChoice",
		availability: "coming-soon",
		accent: "from-pink-400 to-rose-300",
		icon: Music,
		primaryAction: "Preview",
		route: "/games/hitster",
		stats: "Party",
	},
	{
		type: "word-games",
		title: "Word Games",
		tagline: "Quick brain sparks",
		description: "Fast shared word rounds for calls, parties, and breaks.",
		joinMode: "room",
		authPolicy: "guestAllowed",
		availability: "coming-soon",
		accent: "from-lime-300 to-emerald-400",
		icon: CircleDot,
		primaryAction: "Preview",
		route: "/games/word-games",
		stats: "Fast play",
	},
] satisfies readonly GameCatalogItem[];

export const GAME_CATALOG: readonly GameCatalogItem[] = Object.freeze(
	GAME_CATALOG_ITEMS.map((game) => Object.freeze(game)),
);

function copyGame(game: GameCatalogItem) {
	return { ...game };
}

export function getVisibleGames() {
	return GAME_CATALOG.map(copyGame);
}

export function getPlayableGames() {
	return GAME_CATALOG.filter((game) => game.availability === "playable").map(
		copyGame,
	);
}

export function getGameByType(type: GameType) {
	const game = GAME_CATALOG.find((item) => item.type === type);
	return game ? copyGame(game) : undefined;
}

export function getCatalogIcon() {
	return Gamepad2;
}

export function getCatalogStatsIcon() {
	return ChartNoAxesColumnIncreasing;
}

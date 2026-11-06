import type { GameType } from "../../games";

export type CatalogText = {
	title: string;
	tagline: string;
	description: string;
	primaryAction: string;
	stats: string;
};

export const catalog = {
	"live-quiz": {
		title: "Live Quiz",
		tagline: "Host-led quiz nights",
		description:
			"Run a room, show questions on the big screen, and let everyone answer from their own device.",
		primaryAction: "Host quiz",
		stats: "Room code",
	},
	backgammon: {
		title: "Backgammon",
		tagline: "Two-player challenge",
		description:
			"Start a board, share a link or QR code, and let your opponent claim the second seat.",
		primaryAction: "Start match",
		stats: "Share link",
	},
	sudoku: {
		title: "Sudoku",
		tagline: "Solo puzzle sessions",
		description:
			"Generate puzzles at four difficulties, annotate with pro notation, or scan a paper puzzle and keep solving digitally.",
		primaryAction: "Play sudoku",
		stats: "Solo",
	},
	chess: {
		title: "Chess",
		tagline: "Direct board duels",
		description: "Share a challenge link and play a clean real-time match.",
		primaryAction: "Start match",
		stats: "2 players",
	},
	hitster: {
		title: "Hitster",
		tagline: "Music timeline party",
		description:
			"Host a music round and place songs on a shared timeline with friends.",
		primaryAction: "Host room",
		stats: "Room code",
	},
	"word-links": {
		title: "Word Links",
		tagline: "Daily grouping puzzle",
		description:
			"Sort 16 words into four hidden groups. A fresh daily puzzle plus a stack of practice puzzles.",
		primaryAction: "Play daily",
		stats: "Daily",
	},
	"connect-four": {
		title: "Connect Four",
		tagline: "Drop, stack, connect",
		description:
			"Classic four-in-a-row. Share a challenge link and drop discs in real time.",
		primaryAction: "Start game",
		stats: "2 players",
	},
	"signal-words": {
		title: "Signal Words",
		tagline: "Team clue battles",
		description:
			"Two teams, one grid of 25 words. Clue-givers signal, teams guess — and everyone avoids the trap tile.",
		primaryAction: "Host room",
		stats: "Room code",
	},
	"bluff-dice": {
		title: "Bluff Dice",
		tagline: "Hidden dice, bold claims",
		description:
			"Everyone rolls hidden dice, claims climb higher, and one challenge reveals who was bluffing.",
		primaryAction: "Host table",
		stats: "2-8 players",
	},
	"squad-surge": {
		title: "Squad Surge",
		tagline: "Grow your army, break the line",
		description:
			"Steer your squad through multiplier gates, survive enemy waves, and outnumber the boss at the finish.",
		primaryAction: "Deploy squad",
		stats: "Solo",
	},
	"card-games": {
		title: "Card Club",
		tagline: "Pesten, Jokeren and more",
		description:
			"Classic Dutch card games at one table. Play the computer straight away or invite friends with a room code.",
		primaryAction: "Pick a game",
		stats: "2-8 players",
	},
} satisfies Record<GameType, CatalogText>;

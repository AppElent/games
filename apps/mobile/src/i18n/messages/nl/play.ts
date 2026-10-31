import type { play as en } from "../en/play";

export const play = {
	title: "Arcade Club",
	subtitle: "Kies een spel.",
	continue: "Verder spelen",
	onlineGame: "Online spel",
	savedGame: "Opgeslagen spel",
	games: {
		sudoku: {
			title: "Sudoku",
			tagline: "Klassiek, Killer en Binair. Werkt offline.",
		},
		backgammon: {
			title: "Backgammon",
			tagline: "Samen op deze telefoon, of daag een vriend uit.",
		},
		hitster: {
			title: "Hitster",
			tagline: "Zet nummers op je tijdlijn. Host een feestkamer.",
		},
	},
	otherGames: {
		"live-quiz": "Live quiz",
		chess: "Schaken",
		"connect-four": "Vier op een rij",
		"signal-words": "Signal Words",
		"bluff-dice": "Blufdobbelen",
		"word-links": "Word Links",
		"squad-surge": "Squad Surge",
	},
} satisfies typeof en;

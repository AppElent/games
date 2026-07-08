import type { GameType } from "#/lib/games/catalog";
import type { CatalogText } from "../en/catalog";

export const catalog = {
	"live-quiz": {
		title: "Live quiz",
		tagline: "Quizavonden met een host",
		description:
			"Open een kamer, toon vragen op het grote scherm en laat iedereen antwoorden op z'n eigen apparaat.",
		primaryAction: "Quiz hosten",
		stats: "Kamercode",
	},
	backgammon: {
		title: "Backgammon",
		tagline: "Uitdaging voor twee",
		description:
			"Start een bord, deel een link of QR-code en laat je tegenstander de tweede stoel innemen.",
		primaryAction: "Partij starten",
		stats: "Deellink",
	},
	sudoku: {
		title: "Sudoku",
		tagline: "Solo puzzelsessies",
		description:
			"Genereer puzzels in vier moeilijkheidsgraden, noteer met pro-notatie of scan een papieren puzzel en los 'm digitaal op.",
		primaryAction: "Sudoku spelen",
		stats: "Solo",
	},
	chess: {
		title: "Schaken",
		tagline: "Directe bordduels",
		description:
			"Deel een uitdagingslink en speel een strakke realtime partij.",
		primaryAction: "Partij starten",
		stats: "2 spelers",
	},
	hitster: {
		title: "Hitster",
		tagline: "Muziek-tijdlijnfeest",
		description:
			"Host een muziekronde en plaats nummers op een gedeelde tijdlijn met vrienden.",
		primaryAction: "Kamer openen",
		stats: "Kamercode",
	},
	"word-links": {
		title: "Word Links",
		tagline: "Dagelijkse groepeerpuzzel",
		description:
			"Sorteer 16 woorden in vier verborgen groepen. Elke dag een verse puzzel plus een stapel oefenpuzzels.",
		primaryAction: "Speel de dagpuzzel",
		stats: "Dagelijks",
	},
	"connect-four": {
		title: "Vier op een rij",
		tagline: "Laat vallen, stapel, verbind",
		description:
			"De klassieker: vier op een rij. Deel een uitdagingslink en laat schijven realtime vallen.",
		primaryAction: "Spel starten",
		stats: "2 spelers",
	},
	"signal-words": {
		title: "Signal Words",
		tagline: "Teamduels met hints",
		description:
			"Twee teams, één raster van 25 woorden. Hintgevers seinen, teams raden — en iedereen vermijdt de valtegel.",
		primaryAction: "Kamer openen",
		stats: "Kamercode",
	},
	"bluff-dice": {
		title: "Blufdobbelen",
		tagline: "Verborgen dobbelstenen, gedurfde claims",
		description:
			"Iedereen rolt verborgen dobbelstenen, de claims klimmen steeds hoger en één uitdaging onthult wie er blufte.",
		primaryAction: "Tafel openen",
		stats: "2-8 spelers",
	},
	"squad-surge": {
		title: "Squad Surge",
		tagline: "Laat je leger groeien, breek door de linie",
		description:
			"Stuur je squad door multiplier-poorten, overleef vijandelijke golven en overtref de eindbaas bij de finish.",
		primaryAction: "Squad inzetten",
		stats: "Solo",
	},
} satisfies Record<GameType, CatalogText>;

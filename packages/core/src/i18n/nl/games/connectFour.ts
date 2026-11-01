import type { connectFour as enConnectFour } from "../../en/games/connectFour";

export const connectFour = {
	game: {
		boardLoading: "Bord wordt geladen...",
		dropInColumn: "Laten vallen in kolom {column}",
		emptyCell: "leeg",
	},
	players: {
		red: "rood",
		yellow: "geel",
		openSeat: "Open plek",
		turnBadge: "Beurt",
	},
	status: {
		draw: "Gelijkspel — het bord is vol",
		wins: "{name} wint!",
		winsByResignation: "{name} wint door opgave!",
		winnerFallbackRed: "Rood",
		winnerFallbackYellow: "Geel",
		waitingForOpponent:
			"Deel de link met één tegenstander om de gele plek te claimen.",
		yourMove: "Jouw beurt — kies een kolom.",
		waitingFor: "Wachten op {name}.",
	},
	actions: {
		resign: "Opgeven",
		resignError: "Kon niet opgeven",
		dropError: "Kon niet laten vallen",
	},
	endScreen: {
		shareText: "Vier op een rij op Arcade Club — {status}",
		rematchLabel: "Rematch (kleuren wisselen)",
		rematchError: "Kon rematch niet starten",
	},
	info: {
		button: "Info",
	},
	share: {
		challengeLinkLabel: "Uitdagingslink",
	},
	session: {
		gameNotFound: "Spel niet gevonden.",
		loadingGame: "Spel laden...",
	},
	newGame: {
		heading: "Start een spel",
		instructions:
			"Jij speelt rood en bent als eerste aan zet. Deel de link of QR-code — je tegenstander claimt automatisch de gele plek.",
		creatingChallenge: "Uitdaging aanmaken...",
		createChallengeLink: "Uitdagingslink aanmaken",
		createChallengeError: "Kon uitdaging niet aanmaken",
	},
} satisfies typeof enConnectFour;

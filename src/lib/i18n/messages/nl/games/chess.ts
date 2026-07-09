import type { chess as enChess } from "../../en/games/chess";

export const chess = {
	game: {
		boardLoading: "Bord wordt geladen...",
	},
	players: {
		white: "Wit",
		black: "Zwart",
		colorWhite: "wit",
		colorBlack: "zwart",
		openSeat: "Open plek",
		turnBadge: "Beurt",
	},
	status: {
		gameOver: "Partij afgelopen",
		waitingForOpponent:
			"Deel de link met één tegenstander om de open plek te claimen.",
		yourMove: "Jouw zet",
		yourMoveCheck: "Jouw zet — schaak!",
		waitingFor: "Wachten op {name}",
		waitingForCheck: "Wachten op {name} — schaak!",
		result: {
			checkmate: "Schaakmat — {winner} wint",
			timeout: "Tijd verstreken — {winner} wint",
			resignation: "Opgave — {winner} wint",
			stalemate: "Remise — patstelling",
			insufficientMaterial: "Remise — onvoldoende materiaal",
			threefoldRepetition: "Remise — drievoudige zetherhaling",
			fiftyMoveRule: "Remise — vijftigzettenregel",
			drawAgreed: "Remise — overeengekomen",
		},
	},
	drawOffer: {
		waitingForOpponent: "Remise aangeboden — wachten op je tegenstander.",
		opponentOffers: "Je tegenstander biedt remise aan.",
		accept: "Accepteren",
		acceptError: "Kon remise niet accepteren",
		decline: "Weigeren",
		declineError: "Kon remise niet weigeren",
	},
	actions: {
		offerDraw: "Remise aanbieden",
		offerDrawError: "Kon remise niet aanbieden",
		resign: "Opgeven",
		resignError: "Kon niet opgeven",
		claimWinOnTime: "Winst op tijd claimen",
		claimTimeoutError: "Kon tijd niet claimen",
		moveError: "Kon niet zetten",
	},
	endScreen: {
		youWin: "Je wint!",
		betterLuck: "Meer geluk bij de rematch.",
		shareText: "Schaken op Arcade Club — {status} na {count} halve zetten.",
		rematchLabel: "Rematch (kleuren wisselen)",
		rematchError: "Kon rematch niet starten",
	},
	moveList: {
		heading: "Zetten",
		empty: "Nog geen zetten.",
	},
	info: {
		button: "Info",
	},
	share: {
		challengeLinkLabel: "Uitdagingslink",
	},
	session: {
		matchNotFound: "Partij niet gevonden.",
		loadingMatch: "Partij laden...",
	},
	newGame: {
		heading: "Start een partij",
		defaultTitle: "Schaakpartij",
		timeControlLegend: "Bedenktijd",
		colorLegend: "Jouw kleur",
		colorOptions: {
			random: "willekeurig",
			white: "wit",
			black: "zwart",
		},
		creatingChallenge: "Uitdaging aanmaken...",
		createChallengeLink: "Uitdagingslink aanmaken",
		createChallengeError: "Kon uitdaging niet aanmaken",
		shareInstructions:
			"Deel de link of QR-code — je tegenstander claimt automatisch de open plek.",
	},
} satisfies typeof enChess;

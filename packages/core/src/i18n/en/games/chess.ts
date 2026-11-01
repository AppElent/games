/** Chess UI chrome. Algebraic notation in the move list (e.g. "e4", "Nf3",
 * "O-O") and internal piece codes used for square aria-labels (e.g. "wp",
 * "bn") are universal chess notation, not English prose, and are never
 * routed through message keys. This match screen never renders spelled-out
 * piece names (King, Queen, ...), so no piece-name glossary is needed here. */
export const chess = {
	game: {
		boardLoading: "Board is loading...",
	},
	players: {
		white: "White",
		black: "Black",
		colorWhite: "white",
		colorBlack: "black",
		openSeat: "Open seat",
		turnBadge: "Turn",
	},
	status: {
		gameOver: "Game over",
		waitingForOpponent:
			"Share the link with one opponent to claim the open seat.",
		yourMove: "Your move",
		yourMoveCheck: "Your move — check!",
		waitingFor: "Waiting for {name}",
		waitingForCheck: "Waiting for {name} — check!",
		result: {
			checkmate: "Checkmate — {winner} wins",
			timeout: "Time out — {winner} wins",
			resignation: "Resignation — {winner} wins",
			stalemate: "Draw — stalemate",
			insufficientMaterial: "Draw — insufficient material",
			threefoldRepetition: "Draw — threefold repetition",
			fiftyMoveRule: "Draw — fifty-move rule",
			drawAgreed: "Draw — agreed",
		},
	},
	drawOffer: {
		waitingForOpponent: "Draw offered — waiting for your opponent.",
		opponentOffers: "Your opponent offers a draw.",
		accept: "Accept",
		acceptError: "Could not accept draw",
		decline: "Decline",
		declineError: "Could not decline draw",
	},
	actions: {
		offerDraw: "Offer draw",
		offerDrawError: "Could not offer draw",
		resign: "Resign",
		resignError: "Could not resign",
		claimWinOnTime: "Claim win on time",
		claimTimeoutError: "Could not claim timeout",
		moveError: "Could not move",
	},
	endScreen: {
		youWin: "You win!",
		betterLuck: "Better luck in the rematch.",
		shareText: "Chess on Arcade Club — {status} after {count} half-moves.",
		rematchLabel: "Rematch (colors swap)",
		rematchError: "Could not start rematch",
	},
	moveList: {
		heading: "Moves",
		empty: "No moves yet.",
	},
	info: {
		button: "Info",
	},
	share: {
		challengeLinkLabel: "Challenge link",
	},
	session: {
		matchNotFound: "Match not found.",
		loadingMatch: "Loading match...",
	},
	newGame: {
		heading: "Start a match",
		defaultTitle: "Chess Match",
		timeControlLegend: "Time control",
		colorLegend: "Your color",
		colorOptions: {
			random: "random",
			white: "white",
			black: "black",
		},
		creatingChallenge: "Creating challenge...",
		createChallengeLink: "Create challenge link",
		createChallengeError: "Could not create challenge",
		shareInstructions:
			"Share the link or QR code — your opponent claims the open seat automatically.",
	},
};

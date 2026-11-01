/** Connect Four UI chrome. Column numbers used in drop actions and
 * accessibility labels are a positional game mechanic, not translatable
 * prose, and are never routed through message keys. */
export const connectFour = {
	game: {
		boardLoading: "Board is loading...",
		dropInColumn: "Drop in column {column}",
		emptyCell: "empty",
	},
	players: {
		red: "red",
		yellow: "yellow",
		openSeat: "Open seat",
		turnBadge: "Turn",
	},
	status: {
		draw: "Draw — the board is full",
		wins: "{name} wins!",
		winsByResignation: "{name} wins by resignation!",
		winnerFallbackRed: "Red",
		winnerFallbackYellow: "Yellow",
		waitingForOpponent:
			"Share the link with one opponent to claim the yellow seat.",
		yourMove: "Your move — pick a column.",
		waitingFor: "Waiting for {name}.",
	},
	actions: {
		resign: "Resign",
		resignError: "Could not resign",
		dropError: "Could not drop",
	},
	endScreen: {
		shareText: "Connect Four on Arcade Club — {status}",
		rematchLabel: "Rematch (colors swap)",
		rematchError: "Could not start rematch",
	},
	info: {
		button: "Info",
	},
	share: {
		challengeLinkLabel: "Challenge link",
	},
	session: {
		gameNotFound: "Game not found.",
		loadingGame: "Loading game...",
	},
	newGame: {
		heading: "Start a game",
		instructions:
			"You play red and move first. Share the link or QR code — your opponent claims the yellow seat automatically.",
		creatingChallenge: "Creating challenge...",
		createChallengeLink: "Create challenge link",
		createChallengeError: "Could not create challenge",
	},
};

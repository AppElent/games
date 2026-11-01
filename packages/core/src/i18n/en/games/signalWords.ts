/** Signal Words UI chrome. The word-pack words shown on the board are
 * content, not English prose, and are never routed through message keys. */
export const signalWords = {
	loading: {
		kicker: "Setting up",
		heading: "Room is loading",
	},
	teams: {
		nameRed: "Red",
		nameBlue: "Blue",
		nameRedLower: "red",
		nameBlueLower: "blue",
		label: "{team} team",
		clueGiverTag: "clue-giver",
		noPlayersYet: "No players yet",
		joinAsGuesser: "Join as guesser",
		joinAsClueGiver: "Be clue-giver",
		joinError: "Could not join team",
	},
	roles: {
		red: "red",
		blue: "blue",
		neutral: "neutral",
		trap: "trap",
	},
	status: {
		pickTeams:
			"Pick teams — each team needs one clue-giver and at least one guesser.",
		teamWins: "{team} team wins!",
		teamWinsByTrap: "{team} team wins — {trapTeam} hit the trap tile!",
		waitingForClueGiver: "Waiting for the {team} clue-giver...",
		guessing: '{team} team is guessing: "{clue}" ({count}) — {guessesLeft}',
		guessesLeftCount: {
			one: "{count} guess left.",
			other: "{count} guesses left.",
		},
	},
	actions: {
		startGame: "Start game",
		startGameError: "Could not start the game",
		guessError: "Could not guess",
		passTurn: "Pass turn",
		passError: "Could not pass",
		playAgain: "Play again (new board)",
		rematchError: "Could not start rematch",
	},
	clueForm: {
		label: "One-word clue",
		placeholder: "Clue",
		countLabel: "Count",
		submit: "Send clue",
		error: "Could not send clue",
	},
	share: {
		invitePlayers: "Invite players",
	},
	howToPlay: {
		heading: "How to play",
		step1: "Clue-givers see the hidden key and send a one-word clue.",
		step2: "Guessers tap words — team words keep the turn going.",
		step3: "Decoys end the turn; the trap tile loses instantly.",
		step4: "Clear all your team's words first to win.",
	},
	newGame: {
		heading: "Host a room",
		description:
			"Two teams race to find their signal words from one-word clues. 4+ players — each team needs a clue-giver and at least one guesser. Everyone joins with the room code.",
		creatingRoom: "Creating room...",
		createRoom: "Create room",
		createRoomError: "Could not create room",
	},
	session: {
		loading: "Loading room...",
		notFound: "Room not found.",
	},
};

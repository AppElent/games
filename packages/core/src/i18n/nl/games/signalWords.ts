import type { signalWords as enSignalWords } from "../../en/games/signalWords";

export const signalWords = {
	loading: {
		kicker: "Klaarzetten",
		heading: "Kamer wordt geladen",
	},
	teams: {
		nameRed: "Rood",
		nameBlue: "Blauw",
		nameRedLower: "rood",
		nameBlueLower: "blauw",
		label: "Team {team}",
		clueGiverTag: "hintgever",
		noPlayersYet: "Nog geen spelers",
		joinAsGuesser: "Meedoen als rader",
		joinAsClueGiver: "Word hintgever",
		joinError: "Kon niet bij team komen",
	},
	roles: {
		red: "rood",
		blue: "blauw",
		neutral: "neutraal",
		trap: "val",
	},
	status: {
		pickTeams:
			"Kies teams — elk team heeft één hintgever en minstens één rader nodig.",
		teamWins: "Team {team} wint!",
		teamWinsByTrap: "Team {team} wint — {trapTeam} raakte de valtegel!",
		waitingForClueGiver: "Wachten op de hintgever van team {team}...",
		guessing: 'Team {team} raadt: "{clue}" ({count}) — {guessesLeft}',
		guessesLeftCount: {
			one: "nog {count} gok.",
			other: "nog {count} gokken.",
		},
	},
	actions: {
		startGame: "Spel starten",
		startGameError: "Kon het spel niet starten",
		guessError: "Kon niet raden",
		passTurn: "Beurt doorgeven",
		passError: "Kon beurt niet doorgeven",
		playAgain: "Opnieuw spelen (nieuw bord)",
		rematchError: "Kon rematch niet starten",
	},
	clueForm: {
		label: "Hint van één woord",
		placeholder: "Hint",
		countLabel: "Aantal",
		submit: "Hint versturen",
		error: "Kon hint niet versturen",
	},
	share: {
		invitePlayers: "Spelers uitnodigen",
	},
	howToPlay: {
		heading: "Hoe te spelen",
		step1:
			"Hintgevers zien de verborgen sleutel en sturen een hint van één woord.",
		step2: "Raders tikken op woorden — teamwoorden houden de beurt in gang.",
		step3: "Lokwoorden beëindigen de beurt; de valtegel verliest meteen.",
		step4: "Ontdek eerst alle woorden van je eigen team om te winnen.",
	},
	newGame: {
		heading: "Een kamer openen",
		description:
			"Twee teams racen om hun signaalwoorden te vinden met hints van één woord. 4+ spelers — elk team heeft een hintgever en minstens één rader nodig. Iedereen doet mee met de kamercode.",
		creatingRoom: "Kamer wordt aangemaakt...",
		createRoom: "Kamer aanmaken",
		createRoomError: "Kon kamer niet aanmaken",
	},
	session: {
		loading: "Kamer wordt geladen...",
		notFound: "Kamer niet gevonden.",
	},
} satisfies typeof enSignalWords;

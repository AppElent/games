import type { bluffDice as enBluffDice } from "../../en/games/bluffDice";

export const bluffDice = {
	room: {
		loadingKicker: "Klaarzetten",
		loadingHeading: "Kamer wordt geladen",
		playerFallback: "Speler",
		waitingForPlayers:
			"Wachten op spelers — de host start het spel (2-8 spelers).",
		winsTable: "{name} wint de tafel!",
		someoneFallback: "Iemand",
		yourTurnRaiseOrChallenge:
			"Jij bent aan de beurt — verhoog het bod of daag uit.",
		yourTurnFirstClaim: "Jij bent aan de beurt — doe het eerste bod.",
		waitingForPlayer: "Wachten op {name}...",
		diceCount: { one: "{count} dobbelsteen", other: "{count} dobbelstenen" },
		diceOut: "uit",
		startGameButton: "Spel starten",
		couldNotStartGame: "Kon het spel niet starten",
		lastChallengeKicker: "Laatste uitdaging",
		challengeSummary:
			"{challenger} daagde het bod van {claimant} uit: {claim} — er waren er {actual}.",
		loserLosesDie: "{name} verliest een dobbelsteen.",
		yourDiceKicker: "Jouw dobbelstenen",
		roundLabel: "Ronde {number}",
		diceOnTable: {
			one: "{count} dobbelsteen op tafel",
			other: "{count} dobbelstenen op tafel",
		},
		currentClaimBy: "Huidig bod van {name}:",
		noClaimYet: "Nog geen bod deze ronde.",
		quantityLabel: "Aantal",
		faceLabel: "Ogen",
		claimButton: "Bieden",
		couldNotClaim: "Kon niet bieden",
		challengeButton: "Uitdagen!",
		couldNotChallenge: "Kon niet uitdagen",
		couldNotStartRematch: "Kon rematch niet starten",
		howToPlayKicker: "Zo werkt het",
		howToPlayRollDice: "Iedereen gooit verborgen dobbelstenen.",
		howToPlayClaim:
			"Om de beurt claim je hoeveel van een bepaald oog er in totaal liggen.",
		howToPlayOutrank:
			"Elk bod moet hoger zijn dan het vorige — of je daagt uit.",
		howToPlayLoseDie:
			"Wie het mis heeft verliest een dobbelsteen. De laatste speler met dobbelstenen wint.",
	},
	share: {
		invitePlayers: "Spelers uitnodigen",
	},
	new: {
		heading: "Open een tafel",
		description:
			"Verborgen dobbelstenen, oplopende bluffen, en één grote vraag: bluft er iemand? 2-8 spelers, iedereen doet mee met de kamercode.",
		createRoomButton: "Kamer aanmaken",
		creatingRoomButton: "Kamer wordt aangemaakt...",
		couldNotCreateRoom: "Kon kamer niet aanmaken",
	},
	session: {
		loadingTable: "Tafel wordt geladen...",
		tableNotFound: "Tafel niet gevonden.",
	},
} satisfies typeof enBluffDice;

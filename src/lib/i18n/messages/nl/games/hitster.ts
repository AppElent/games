import type { hitster as enHitster } from "../../en/games/hitster";

export const hitster = {
	musicTimelineKicker: "Muziektijdlijn",
	bits: {
		participantFallbackTeam: "Team",
		participantFallbackPlayer: "Speler",
		timeline: {
			placeHere: "Hier plaatsen (positie {position})",
		},
		tokens: {
			count: { one: "{count} fiche", other: "{count} fiches" },
		},
		scoreboard: {
			teamProgress: "Teamvoortgang",
			cardsProgress: "{cards} / {target} kaarten",
			standingsHeading: "Stand · als eerste tot {target}",
			winner: "Winnaar",
			cardsCount: { one: "{count} kaart", other: "{count} kaarten" },
			tokensAbbrev: "{count} tk",
		},
		rules: {
			listenTogetherHeading: "Samen luisteren",
			listenTogetherBody:
				"De host speelt een mysterienummer af. Niemand ziet de titel, artiest of het jaar.",
			placeInTimeHeading: "Plaats het in de tijd",
			placeInTimeBodyShared:
				"De actieve speler plaatst het nummer op de gedeelde teamtijdlijn.",
			placeInTimeBodySolo:
				"De actieve speler plaatst het nummer op de eigen tijdlijn.",
			revealScoreHeading: "Onthullen en scoren",
			revealScoreBodyShared:
				"Juist behoudt de kaart. Onjuist kost het team een fiche. Haal {target} kaarten voordat de {tokens} fiches op zijn.",
			revealScoreBodySolo:
				"Juiste plaatsingen laten je tijdlijn groeien. Wie als eerste {target} kaarten heeft, wint.",
			earnTokensHeading: "Verdien fiches",
			earnTokensBody:
				"Noem artiest en titel voor een bonusfiche (max {cap}). Gebruik een fiche om een gemiste kaart te stelen.",
			nameToClaimHeading: "Noem het om het te claimen",
			nameToClaimBodyYear:
				"Je wint de kaart alleen bij een juiste plaatsing plus het exacte jaar, de artiest en de titel. Geen nieuwe fiches.",
			nameToClaimBodyNoYear:
				"Je wint de kaart alleen bij een juiste plaatsing plus de artiest en de titel. Geen nieuwe fiches.",
		},
		recap: {
			heading: "Terugblik ronde {round}",
			correctWord: "juist",
			wrongWord: "onjuist",
			placementLine: "{name}: plaatsing {result}",
			artistLine: "Artiest {result}",
			titleLine: "Titel {result}",
			yearLine: "Jaar {result}",
			cardStaysTeam: "De kaart blijft op de teamtijdlijn.",
			cardDiscardedTeam:
				"De kaart wordt afgelegd en het team verliest een fiche.",
			wonByName: "{name} wint de kaart.",
			nobodyWins: "Niemand wint de kaart.",
			stealWonCard: "won de kaart",
			stealCorrectTooLate: "juist, maar te laat",
			stealMissed: "gemist",
			stealByLine: "Diefstal door {name}: {result} (−1 fiche)",
		},
	},
	hostView: {
		kicker: "Muziektijdlijn · host",
		roomHeading: "{label}-kamer",
		packSummaryWithTracks:
			"{packTitle}-pack · eerst tot {target} kaarten · nog {count} nummers over",
		packSummaryNoTracks: "{packTitle}-pack · eerst tot {target} kaarten",
		joinCodeLabel: "Kamercode",
		lobbyInstructionsShared:
			"Deel de kamercode. Iedereen die meedoet voordat het spel start, speelt op één gedeelde teamtijdlijn.",
		lobbyInstructionsSolo:
			"Deel de kamercode. Iedereen die meedoet voordat het spel start, speelt mee.",
		startGame: "Start spel",
		djPanelKicker: "DJ-paneel · houd dit weg bij de spelers",
		revealTrackSummary: "Toon mysterienummer voor afspelen",
		findOnSpotify: "Zoek op Spotify",
		placementLocked: "Plaatsing vastgezet",
		waitingForPlacement: "Wachten op de plaatsing",
		stealClaims: {
			one: "{count} diefstalclaim",
			other: "{count} diefstalclaims",
		},
		revealYear: "Onthul jaar",
		nextRound: "Volgende ronde",
		actionFailed: "Actie mislukt",
	},
	setupForm: {
		gameModeLabel: "Spelmodus",
		songPackLabel: "Nummerpack",
		packOption: {
			one: "{packTitle} ({count} nummer)",
			other: "{packTitle} ({count} nummers)",
		},
		cardsToWinLabel: "Kaarten om te winnen",
		cardsOption: "{count} kaarten",
		turnTimerLabel: "Beurttimer",
		noTimer: "Geen timer",
		timerSecondsOption: "{count} seconden",
		playableTracksInfo: {
			one: "{count} speelbaar nummer met afspelen via het apparaat van de host. De host speelt elk mysterienummer af op de eigen speaker (bijvoorbeeld via Spotify) — dit prototype streamt zelf geen audio.",
			other:
				"{count} speelbare nummers met afspelen via het apparaat van de host. De host speelt elk mysterienummer af op de eigen speaker (bijvoorbeeld via Spotify) — dit prototype streamt zelf geen audio.",
		},
		createRoomError: "Kon de kamer niet aanmaken",
		creatingRoom: "Kamer aanmaken...",
		createRoom: "Muziekkamer aanmaken",
	},
	stage: {
		hostStillSettingUp: "De host is het spel nog aan het instellen.",
		statusWaitingForHost: "Wachten tot de host start",
		statusNowPlaying: "Ronde {round} · beurt van {name}",
		statusRevealed: "Ronde {round} onthuld",
		statusGameOver: "Spel afgelopen",
		remainingSeconds: "{count}s",
		howItWorksHeading: "Hoe {mode} werkt",
		yourTurnHeading: "Jouw beurt · plaats het mysterienummer",
		placementLocked: "Plaatsing vastgezet",
		waitingForHostReveal: "Wachten tot de host het jaar onthult.",
		nowPlayingHeading: "Nu bezig · antwoorden verborgen",
		activePlacingSongLocked: "{name} plaatst het nummer. Plaatsing vastgezet.",
		activePlacingSongListen: "{name} plaatst het nummer. Luister mee.",
		stealClaimLocked: "Diefstalclaim vastgezet. De onthulling beslist.",
		stealButton: "Denk je dat het fout is? Steel voor 1 fiche",
		stealFormHeading: "Stelen: plaats het op je eigen tijdlijn",
		noTokensToSteal: "Geen fiches meer over om mee te stelen.",
		waitingForNextRound: "Wachten tot de host de volgende ronde start.",
		coopWon: "Tijdlijn compleet — het team wint",
		coopLost: "Geen fiches meer — de tijdlijn wint",
		teamTimelineHeading: {
			one: "Teamtijdlijn · {count} kaart",
			other: "Teamtijdlijn · {count} kaarten",
		},
		yourTimelineHeading: {
			one: "Jouw tijdlijn · {count} kaart",
			other: "Jouw tijdlijn · {count} kaarten",
		},
		placementInstructions:
			"Kies de plek waar het mysterienummer hoort. Jaartallen lopen op van links naar rechts.",
		artistLabelRequired: "Artiest (verplicht om te winnen)",
		artistLabelBonus: "Artiest (bonusfiche)",
		titleLabelRequired: "Titel (verplicht om te winnen)",
		titleLabelBonus: "Titel (bonusfiche)",
		artistPlaceholder: "Wie speelt het?",
		titlePlaceholder: "Hoe heet het?",
		exactYearLabel: "Exact jaar (verplicht om te winnen)",
		yearPlaceholder: "bijv. 1987",
		submitError: "Kon niet versturen",
		stealSubmit: "Gebruik 1 fiche · zet diefstal vast",
		lockPlacement: "Zet plaatsing vast",
	},
	newGame: {
		heading: "Open een muziektijdlijnkamer",
		intro:
			"Kies een modus en een nummerpack, nodig spelers uit met een code en plaats mysterienummers op de juiste plek in de tijdlijn.",
	},
	session: {
		loadingRoom: "Kamer laden...",
		roomNotFound: "Kamer niet gevonden.",
		hostSessionExpired: "Hostsessie verlopen. Maak een nieuwe kamer aan.",
		loadingGame: "Spel laden...",
		gameNotFound: "Spel niet gevonden.",
		joinFirst: "Doe eerst mee aan deze kamer met de code van de startpagina.",
	},
} satisfies typeof enHitster;

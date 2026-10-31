export const hitster = {
	title: "Hitster",
	setup: {
		intro:
			"Open een muziekkamer: vrienden doen mee met een code, jij speelt mysterienummers af op je speaker en iedereen plaatst ze op een tijdlijn.",
		mode: "Spelmodus",
		pack: "Nummerpack",
		packTracks: { one: "{count} nummer", other: "{count} nummers" },
		target: "Kaarten om te winnen",
		timer: "Beurttimer",
		noTimer: "Uit",
		seconds: "{count}s",
		playbackNote:
			"Je speelt elk nummer zelf af, bijvoorbeeld via Spotify. De app laat zien welk nummer; hij streamt zelf geen audio.",
		create: "Kamer openen",
		couldNotCreate: "De kamer kon niet worden geopend. Probeer het opnieuw.",
		joinInstead: "Heb je een code? Doe mee met een kamer",
	},
	modes: {
		instant: {
			label: "Instant Party",
			summary:
				"Plaats het nummer op de juiste plek. Wie als eerste het doel haalt, wint.",
		},
		original: {
			label: "Origineel",
			summary:
				"Plaats het in de tijd. Noem artiest en titel voor een bonusfiche. Met fiches kun je stelen.",
		},
		pro: {
			label: "Pro",
			summary:
				"Je wint de kaart alleen met de juiste plek plus artiest en titel. Geen nieuwe fiches.",
		},
		expert: {
			label: "Expert",
			summary:
				"De juiste plek plus het exacte jaar, de artiest en de titel. Geen nieuwe fiches.",
		},
		coop: {
			label: "Coöperatief",
			summary:
				"Eén gedeelde tijdlijn en 5 teamfiches. Een verkeerde plek kost een fiche.",
		},
	},
	room: {
		title: "Muziekkamer",
		roomCode: "Kamercode",
		shareCode: "Code delen",
		players: "Spelers",
		waitingForHost: "Wachten tot de host start.",
		start: "Spel starten",
		needPlayers: "Er zijn minstens twee spelers nodig (één voor Coöperatief).",
		round: "Ronde {round}",
		turnOf: "Beurt van {name}",
		revealed: "Ronde {round} onthuld",
		gameOver: "Spel afgelopen",
		remaining: "Nog {count}s",
		tokens: { one: "{count} fiche", other: "{count} fiches" },
		teamTokens: { one: "{count} teamfiche", other: "{count} teamfiches" },
		actionFailed: "Dat is niet gelukt. Probeer het opnieuw.",
		notSeated:
			"Deze telefoon zit niet in deze kamer. Doe eerst mee met de kamercode.",
	},
	dj: {
		heading: "DJ-paneel",
		hint: "Houd dit scherm uit het zicht van de spelers.",
		showTrack: "Toon het mysterienummer",
		hideTrack: "Verberg het nummer",
		findOnSpotify: "Zoek op Spotify",
		placementLocked: "Plaatsing vastgezet",
		waitingForPlacement: "Wachten op de plaatsing",
		stealClaims: {
			one: "{count} diefstalclaim",
			other: "{count} diefstalclaims",
		},
		reveal: "Jaar onthullen",
		nextRound: "Volgende ronde",
	},
	stage: {
		howItWorks: "Hoe {mode} werkt",
		yourTurn: "Jouw beurt: plaats het mysterienummer",
		placementLocked: "Plaatsing vastgezet",
		waitingForReveal: "Wachten tot de host het jaar onthult.",
		listening: "{name} plaatst het nummer. Luister mee.",
		listeningLocked: "{name} heeft het nummer geplaatst.",
		steal: "Denk je dat het fout is? Steel voor 1 fiche",
		stealHeading: "Stelen: plaats het op je eigen tijdlijn",
		stealLocked: "Diefstalclaim vastgezet. De onthulling beslist.",
		noTokens: "Geen fiches meer om mee te stelen.",
		cancelSteal: "Laat maar",
		waitingForNextRound: "Wachten tot de host de volgende ronde start.",
		coopWon: "Tijdlijn compleet: het team wint!",
		coopLost: "Geen fiches meer: de tijdlijn wint.",
		teamTimeline: {
			one: "Teamtijdlijn · {count} kaart",
			other: "Teamtijdlijn · {count} kaarten",
		},
		yourTimeline: {
			one: "Jouw tijdlijn · {count} kaart",
			other: "Jouw tijdlijn · {count} kaarten",
		},
		placementHelp:
			"Tik waar het mysterienummer hoort. Het oudste staat bovenaan.",
		placeHere: "Hier plaatsen",
		placeHereLabel: "Plaats op positie {position}",
		selectedSpot: "Gekozen plek",
		artistRequired: "Artiest (verplicht om te winnen)",
		artistBonus: "Artiest (bonusfiche)",
		titleRequired: "Titel (verplicht om te winnen)",
		titleBonus: "Titel (bonusfiche)",
		artistPlaceholder: "Wie speelt het?",
		titlePlaceholder: "Hoe heet het?",
		yearRequired: "Exact jaar (verplicht om te winnen)",
		yearPlaceholder: "bijv. 1987",
		lock: "Plaatsing vastzetten",
		lockSteal: "Gebruik 1 fiche en zet vast",
	},
	rules: {
		listenHeading: "Samen luisteren",
		listenBody:
			"De host speelt een mysterienummer af. Niemand ziet de titel, artiest of het jaar.",
		placeHeading: "Plaats het in de tijd",
		placeBodyShared:
			"De actieve speler plaatst het nummer op de gedeelde teamtijdlijn.",
		placeBodySolo: "De actieve speler plaatst het nummer op de eigen tijdlijn.",
		scoreHeading: "Onthullen en scoren",
		scoreBodyShared:
			"Juist behoudt de kaart. Onjuist kost het team een fiche. Haal {target} kaarten voordat de {tokens} fiches op zijn.",
		scoreBodySolo:
			"Juiste plaatsingen laten je tijdlijn groeien. Wie als eerste {target} kaarten heeft, wint.",
		tokensHeading: "Verdien fiches",
		tokensBody:
			"Noem artiest en titel voor een bonusfiche (max {cap}). Gebruik een fiche om een gemiste kaart te stelen.",
		claimHeading: "Noem het om het te claimen",
		claimBodyYear:
			"Je wint de kaart alleen met de juiste plek plus het exacte jaar, de artiest en de titel.",
		claimBodyNoYear:
			"Je wint de kaart alleen met de juiste plek plus artiest en titel.",
	},
	recap: {
		heading: "Ronde {round}",
		correct: "juist",
		wrong: "onjuist",
		placement: "{name}: plaatsing {result}",
		artist: "Artiest {result}",
		title: "Titel {result}",
		year: "Jaar {result}",
		teamKeeps: "De kaart blijft op de teamtijdlijn.",
		teamLoses: "De kaart vervalt en het team verliest een fiche.",
		wonBy: "{name} wint de kaart.",
		nobody: "Niemand wint de kaart.",
		stealWon: "won de kaart",
		stealLate: "juist, maar te laat",
		stealMissed: "mis",
		steal: "Diefstal door {name}: {result}",
	},
	scoreboard: {
		heading: "Stand · als eerste tot {target}",
		team: "Teamvoortgang",
		progress: "{cards} / {target} kaarten",
		cards: { one: "{count} kaart", other: "{count} kaarten" },
		winner: "Winnaar",
	},
	fallback: { player: "Speler", team: "Team" },
};

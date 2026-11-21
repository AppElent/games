import type { sudoku as enSudoku } from "../../en/games/sudoku";

export const sudoku = {
	hints: {
		cell: "R{row}K{col}",
		row: "rij {n}",
		column: "kolom {n}",
		box: "blok {n}",
		pair: "paar",
		triple: "drietal",
		mistake: {
			title: "Fout",
			nudge: "Er klopt iets niet op het bord. Kijk nog eens naar {unit}.",
			direction: "Een van je cijfers is fout: controleer {cell}.",
			explanation:
				"De {digit} in {cell} hoort daar niet. Wis hem en vraag dan om de volgende stap.",
		},
		nakedSingle: {
			title: "Naakte single",
			nudge: "Kijk goed naar {cell}. Hoeveel cijfers kunnen daar nog?",
			direction:
				"Er is een naakte single in {unit}: een vakje waar alle cijfers op één na zijn uitgesloten.",
			explanation:
				"In {cell} kan nog maar één cijfer: {digit}. Alle andere cijfers staan al in de rij, de kolom of het blok, dus daar komt een {digit}.",
		},
		hiddenSingle: {
			title: "Verborgen single",
			nudge: "Bekijk {unit}: één cijfer heeft daar nog maar één plek.",
			direction:
				"Er is een verborgen single voor {digit} in {unit}. Streep rijen en kolommen weg om het enige vakje te vinden.",
			explanation:
				"Binnen {unit} kan de {digit} alleen in {cell}: elk ander vakje ziet al een {digit} in zijn rij, kolom of blok.",
			crossHatch:
				" Dat zie je door de rijen en kolommen die door het blok lopen weg te strepen.",
		},
		pointing: {
			title: "Wijzend {set}",
			nudge: "Kijk waar de {digit} in {box} kan. Valt je iets op aan de vorm?",
			direction:
				"Er is een wijzend {set} in {box}: alle kandidaten voor {digit} liggen in {line}, en dat beperkt de rest van die lijn.",
			explanation:
				"In {box} kan de {digit} alleen in {cells}, allemaal in {line}. Waar hij ook komt, {line} krijgt zijn {digit} uit dit blok, dus de {digit} valt af in {eliminated}.",
		},
		boxLine: {
			title: "Blok-lijnreductie",
			nudge:
				"Kijk waar de {digit} in {line} kan. De mogelijkheden liggen dicht bij elkaar.",
			direction:
				"Blok-lijnreductie in {line}: alle kandidaten voor {digit} liggen in {box}.",
			explanation:
				"In {line} kan de {digit} alleen in {cells}, allemaal binnen {box}. Het blok moet zijn {digit} dus uit die lijn halen, en de {digit} valt af in {eliminated}.",
		},
		nakedSet: {
			title: "Naakt {set}",
			nudge:
				"Vergelijk de kandidaten in {unit}. Sommige vakjes delen precies dezelfde paar cijfers.",
			direction:
				"Er is een naakt {set} in {unit}: {size} vakjes die alleen dezelfde {size} cijfers toelaten.",
			explanation:
				"In {unit} laten de vakjes {cells} alleen {digits} toe. Die cijfers moeten precies in die vakjes, dus ze vallen af in alle andere vakjes van {unit}.",
		},
		hiddenSet: {
			title: "Verborgen {set}",
			nudge:
				"Volg in {unit} waar {digits} nog kunnen. De mogelijkheden overlappen.",
			direction:
				"Er is een verborgen {set} in {unit}: {digits} passen alleen in dezelfde {size} vakjes.",
			explanation:
				"In {unit} kunnen {digits} alleen in {cells}. Die vakjes zijn voor hen gereserveerd, dus alle andere kandidaten vallen daar af.",
		},
		snyder: {
			title: "Snyder-notatie",
			nudge:
				"Het loont om aantekeningen te maken: in {box} heeft één cijfer nog maar twee plekken.",
			direction:
				"Gebruik Snyder-notatie in {box}: zet een hoeknotitie {digit} in de twee vakjes waar hij kan.",
			explanation:
				"In {box} kan de {digit} alleen in {cells}. Zet in allebei een hoeknotitie {digit}. Valt er later één af, dan weet je de andere zeker.",
		},
	},
	saved: {
		empty: "Puzzels die je start verschijnen hier, zodat je later verder kunt.",
		solved: "Opgelost in {time}",
		inProgress: "{time} gespeeld",
		deleteTitle: "Deze puzzel verwijderen?",
		deleteBody: "De voortgang wordt van dit apparaat verwijderd.",
		solvedOnAccount: "Opgelost",
		inProgressOnAccount: "Bezig",
		waitingToSync: "Wacht op synchronisatie",
		removeTitle: "Deze puzzel uit de lijst halen?",
		removeAccountBody: "Hij blijft in je account, en op het web.",
	},
	difficulty: {
		easy: "Makkelijk",
		medium: "Gemiddeld",
		hard: "Moeilijk",
		expert: "Expert",
	},
	variant: {
		classic: "Klassiek",
		killer: "Killer",
		binary: "Binair",
	},
	board: {
		cellLabel: "Rij {row}, kolom {col}",
		given: "gegeven",
		empty: "leeg",
		notes: "notities {digits}",
		cage: "kooisom {sum}",
		conflict: "conflict",
		retapHint:
			"Tik nog eens om van invoermodus te wisselen. Houd ingedrukt om te deselecteren",
		deselectHint: "Houd ingedrukt om te deselecteren",
		deselectAction: "Deselecteren",
	},
	keypad: {
		modeLabel: "Invoermodus",
		digitLabel: "{digit}, nog {count}",
		modes: {
			digit: "Cijfer",
			corner: "Hoek",
			center: "Midden",
			color: "Kleur",
		},
		colorAriaLabel: "Kleur {number}",
		modeAnnouncement: "Invoermodus: {mode}",
		undo: "Ongedaan maken",
		redo: "Opnieuw doen",
		erase: "Wissen",
		hint: "Hint",
	},
	inputSettings: {
		title: "Invoerinstellingen",
		tapCycleLabel: "Nog eens op het geselecteerde vakje tikken wisselt naar",
		tapCycleNote: "Cijfer zit er altijd bij.",
		tapCycleSwitchLabel: "{mode} in de tikvolgorde",
		modes: {
			corner: "Hoeknotities",
			center: "Middennotities",
			color: "Kleuren",
		},
		cornerLayoutLabel: "Plek van hoeknotities",
		cornerLayouts: {
			spread: "Alle hoeken",
			topRight: "Rechtsboven",
		},
	},
	game: {
		timer: "Tijd {time}",
		pausedBody: "Het raster is verborgen zolang de klok stilstaat.",
		noHint: "Geen eenvoudige stap gevonden. Controleer je cijfers op fouten.",
		restartTitle: "Deze puzzel opnieuw starten?",
		restartBody: "Het raster wordt leeggemaakt. Je kunt nog ongedaan maken.",
		renameTooltip: "Naam van deze puzzel wijzigen",
		importedFallback: "Geïmporteerd",
		scannedLabel: "gescand",
		solvedTitle: "Opgelost! 🎉",
		completedIn: "Voltooid in {time}.",
		startAnotherPuzzle: "Start een nieuwe puzzel",
		pausedOverlay: "Gepauzeerd — tik om verder te gaan",
		pauseButton: "Pauzeren",
		hintFallbackTitle: "Hint",
		dismissHint: "Sluiten",
		tellMeMore: "Vertel meer",
		autoCleanupLabel:
			"Notities automatisch verwijderen zodra een cijfer wordt geplaatst",
		restartConfirm:
			"Deze puzzel opnieuw starten? Je voortgang blijft bewaard in de geschiedenis van ongedaan maken.",
		keyboardHelp:
			"Toetsenbord: 1-9 cijfers · Shift+cijfer hoeknotitie · Ctrl+cijfer middennotitie · Spatie wisselt modus · Ctrl+Z/Y ongedaan maken/opnieuw doen · pijltjes bewegen · Esc deselecteert",
	},
	binary: {
		restartBody: "Het raster gaat terug naar de gegeven cijfers.",
		dimensions: "Binair {size}×{size}",
		restartConfirm: "Deze puzzel opnieuw starten?",
		instructions:
			"Tik op een vakje om te wisselen tussen 0 → 1 → leeg. Nooit drie gelijk op een rij, evenveel 0'en als 1'en per lijn, geen dubbele lijnen.",
		remainingCells: {
			one: "nog {count} vakje",
			other: "nog {count} vakjes",
		},
	},
	scan: {
		pageHeading: "Scan een papieren puzzel",
		couldNotReadImage: "Kon de afbeelding niet lezen",
		recognitionFailed: "Herkenning mislukt",
		preparingImage: "Afbeelding voorbereiden...",
		readingCells: "Vakjes lezen {done}/{total}...",
		correctedGridAlt: "Gecorrigeerd sudokuraster",
		uploadInstructions:
			"Fotografeer of upload een gedrukte sudoku — ook eentje waar je al op papier aan begonnen bent. Je controleert het herkende raster voordat je gaat spelen.",
		takePhoto: "Maak een foto",
		choosePhoto: "Kies een foto",
		photoInstructions:
			"Fotografeer een gedrukte sudoku of kies een foto ervan — ook eentje waar je al op papier aan begonnen bent. Je controleert het herkende raster voordat je gaat spelen.",
		entryBlurb: "Fotografeer een puzzel uit de krant of een boek.",
		cameraDenied:
			"Geef in Instellingen toegang tot de camera om een foto te maken.",
		scannedTitle: "Gescande puzzel",
		uploadImage: "Upload een afbeelding",
		dragCorners:
			"Sleep de vier handvatten naar de hoeken van het sudokuraster.",
		uploadedImageAlt: "Geüploade sudoku",
		cornerHandle: "Hoek {number}",
		readGrid: "Lees dit raster",
		scannedImageLabel: "Gescande afbeelding",
		recognizedGridLabel:
			"Herkend raster — tik op een vakje om het te corrigeren",
		lowConfidenceHighlighted: {
			one: "{count} vakje met lage betrouwbaarheid gemarkeerd in amber.",
			other: "{count} vakjes met lage betrouwbaarheid gemarkeerd in amber.",
		},
		allConfident:
			"Alle herkenningen zien er betrouwbaar uit — controleer toch nog even voordat je begint.",
		cellLabel: "Vakje R{row}C{col}",
		lowConfidenceBadge: "lage betrouwbaarheid",
		cellTypeGiven: "Gegeven",
		cellTypeUserDigit: "Jouw cijfer",
		cellTypeCornerNotes: "Hoeknotities",
		cellTypeCenterNotes: "Middennotities",
		cellTypeEmpty: "Leeg",
		clearCell: "Vakje wissen",
		previewLabel: "Voorbeeld — precies hoe de puzzel zal starten",
		validation: {
			conflict: "Sommige cijfers botsen in een rij, kolom of blok.",
			tooFewGivens: {
				one: "Maar {count} gegeven cijfer herkend — een geldige sudoku heeft er minstens {min} nodig.",
				other:
					"Maar {count} gegeven cijfers herkend — een geldige sudoku heeft er minstens {min} nodig.",
			},
			noSolution: "De herkende gegeven cijfers hebben geen oplossing.",
			userDigitsIncompatible:
				"De handgeschreven cijfers passen bij geen enkele oplossing van de gegeven cijfers.",
		},
		multipleSolutionsWarning:
			"De gegeven cijfers laten meer dan één oplossing toe. Je kunt nog steeds spelen, maar controleer voor de zekerheid op gemiste cijfers.",
		uniqueSolution:
			"Ziet er goed uit: de gegeven cijfers leiden tot een unieke oplossing.",
		startOver: "Opnieuw beginnen",
		creatingPuzzle: "Puzzel wordt aangemaakt...",
		confirmAndPlay: "Bevestigen en spelen",
		couldNotCreateSession: "Kon de sessie niet aanmaken",
	},
	newGame: {
		heading: "Start een puzzel",
		intro:
			"Kies een moeilijkheidsgraad en speel solo. Je voortgang wordt automatisch opgeslagen en je kunt meerdere puzzels tegelijk actief houden.",
		nameLabel: "Puzzelnaam (optioneel)",
		namePlaceholder: "Automatisch genoemd naar niveau en tijd",
		gameTypeLegend: "Spelvariant",
		variantBlurbs: {
			classic: "Het vertrouwde 9×9-raster",
			killer: "Kooien moeten optellen tot hun som",
			binary: "Vul het raster met 0'en en 1'en",
		},
		offlineNote: "Puzzels worden op dit apparaat bewaard en werken offline.",
		syncNote:
			"Puzzels werken offline en worden met je account gesynchroniseerd, dus je vindt ze ook op het web.",
		difficultyBlurbs: {
			easy: {
				classic: "Veel aanwijzingen, rustige start",
				killer: "Veel gegeven cijfers, kleine kooien",
				binary: "6×6-raster, rustige start",
			},
			medium: {
				classic: "Singles en simpele paren",
				killer: "Minder gegeven cijfers, vertrouw op de sommen",
				binary: "8×8-raster",
			},
			hard: {
				classic: "Wijzende paren en reducties",
				killer: "Een handvol gegeven cijfers",
				binary: "10×10-raster",
			},
			expert: {
				classic: "Weinig aanwijzingen, grondig speurwerk",
				killer: "Alleen kooien — geen gegeven cijfers",
				binary: "10×10, weinig aanwijzingen",
			},
		},
		generating: "Genereren...",
		scanInstead: "Scan in plaats daarvan een papieren puzzel",
		yourPuzzles: "Jouw puzzels",
		removeFromList: "Verwijder {title} uit deze lijst",
		couldNotStart: "Kon de puzzel niet starten",
	},
	session: {
		loadingPuzzle: "Puzzel laden...",
		puzzleNotFound: "Puzzel niet gevonden.",
		offline: "Maak verbinding met internet om deze puzzel te openen.",
	},
} satisfies typeof enSudoku;

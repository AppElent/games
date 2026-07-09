import type { sudoku as enSudoku } from "../../en/games/sudoku";

export const sudoku = {
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
		cellLabel: "Rij {row} kolom {col}",
	},
	keypad: {
		modeDigit: "Cijfer",
		modeCorner: "Hoek",
		modeCenter: "Midden",
		modeColor: "Kleur",
		colorAriaLabel: "Kleur {number}",
		undo: "Ongedaan maken",
		redo: "Opnieuw doen",
		erase: "Wissen",
		hint: "Hint",
	},
	game: {
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
			"Toetsenbord: 1-9 cijfers · Shift+cijfer hoeknotitie · Ctrl+cijfer middennotitie · Spatie wisselt modus · Ctrl+Z/Y ongedaan maken/opnieuw doen · pijltjes bewegen",
	},
	binary: {
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
		uploadImage: "Upload een afbeelding",
		dragCorners:
			"Sleep de vier handvatten naar de hoeken van het sudokuraster.",
		uploadedImageAlt: "Geüploade sudoku",
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
		variantBlurbClassic: "Het vertrouwde 9×9-raster",
		variantBlurbKiller: "Kooien moeten optellen tot hun som",
		variantBlurbBinary: "Vul het raster met 0'en en 1'en",
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
	},
} satisfies typeof enSudoku;

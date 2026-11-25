import type { sudoku as enSudoku } from "../../en/games/sudoku";

export const sudoku = {
	hints: {
		cell: "R{row}K{col}",
		row: "rij {n}",
		column: "kolom {n}",
		box: "blok {n}",
		pair: "paar",
		triple: "drietal",
		quad: "viertal",
		rows: "rijen {list}",
		columns: "kolommen {list}",
		and: " en ",
		afterEarlierHints:
			" Dit rekent met de kandidaten die eerdere hints al wegstreepten.",
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
		fish: {
			xWing: "X-Wing",
			swordfish: "Swordfish",
			anXWing: "een X-Wing",
			aSwordfish: "een Swordfish",
			title: "{fish}",
			nudge:
				"Volg de {digit} door {base}. In elk ervan heeft hij nog maar een paar plekken.",
			direction:
				"Er is {aFish} op de {digit}: in {base} kan hij alleen in {cover}.",
			explanation:
				"In {base} kan de {digit} alleen in {cells}, allemaal binnen {cover}. {base} krijgen elk hun {digit} in een van deze vakjes, dus {cover} krijgen de hunne daar ook, en de {digit} valt af in {eliminated}.",
		},
		skyscraper: {
			title: "Skyscraper",
			nudge:
				"Kijk naar de {digit} in {base}: in elk ervan heeft hij precies twee plekken.",
			direction:
				"Er is een Skyscraper op de {digit} in {base}: twee sterke koppelingen die op dezelfde lijn staan.",
			explanation:
				"In {base} heeft de {digit} elk maar twee plekken. {shared} liggen op één lijn, dus hooguit één ervan is een {digit}, en minstens één van {ends} moet het zijn. De {digit} valt af in elk vakje dat beide ziet: {eliminated}.",
		},
		twoStringKite: {
			title: "2-String Kite",
			nudge: "Zoek waar de {digit} precies twee plekken heeft in {base}.",
			direction:
				"Er is een 2-String Kite op de {digit}: een sterke koppeling in {base}, verbonden in {box}.",
			explanation:
				"In {base} heeft de {digit} elk maar twee plekken. {shared} liggen in {box}, dus hooguit één ervan is een {digit}, en minstens één van {ends} moet het zijn. De {digit} valt af in elk vakje dat beide ziet: {eliminated}.",
		},
		xyWing: {
			title: "XY-Wing",
			nudge: "Kijk naar de vakjes met maar twee kandidaten rond {pivot}.",
			direction:
				"Er is een XY-Wing met de spil in {pivot}: de twee vleugels delen een {z}.",
			explanation:
				"{pivot} is een {x} of een {y}. Is het een {x}, dan moet {wingX} een {z} zijn; is het een {y}, dan moet {wingY} een {z} zijn. Hoe dan ook heeft één vleugel de {z}, dus de {z} valt af in elk vakje dat beide vleugels ziet: {eliminated}.",
		},
		xyzWing: {
			title: "XYZ-Wing",
			nudge: "Kijk naar {pivot} en de vakjes met twee kandidaten die het ziet.",
			direction:
				"Er is een XYZ-Wing met de spil in {pivot}: de spil en beide vleugels laten een {z} toe.",
			explanation:
				"{pivot} laat {x}, {y} en {z} toe; {wings} laten elk de {z} en een van de andere toe. Wat er ook in de spil komt, een van de drie vakjes is een {z}, dus de {z} valt af in elk vakje dat alle drie ziet: {eliminated}.",
		},
		wWing: {
			title: "W-Wing",
			nudge:
				"{wings} laten dezelfde twee cijfers toe: {digits}. Zoek een koppeling tussen ze.",
			direction:
				"Er is een W-Wing op {wings}, gekoppeld door de {x} in {base}.",
			explanation:
				"In {base} kan de {x} alleen in {link}. Was geen van {wings} een {y}, dan waren ze allebei een {x}, en had {base} geen plek meer voor de {x}. Dus is een van beide een {y}, en de {y} valt af in elk vakje dat beide ziet: {eliminated}.",
		},
		uniqueRectangle: {
			title: "Unieke rechthoek",
			nudge:
				"Vier vakjes in twee blokken delen bijna dezelfde twee kandidaten. Een puzzel met één oplossing laat dat niet toe.",
			direction: "Er is een unieke rechthoek op {digits} in {cells}.",
			explanation:
				"{floor} laten alleen {digits} toe. Kon {target} ook alleen een {x} of {y} worden, dan konden de vier vakjes die cijfers ruilen en had de puzzel twee oplossingen. Hij heeft er één, dus {digits} vallen af in {target}.",
		},
		bugPlusOne: {
			title: "BUG+1",
			nudge:
				"Bijna elk open vakje heeft nog twee kandidaten. Eén vakje is de uitzondering.",
			direction:
				"Dit is een BUG+1: elk open vakje heeft twee kandidaten, behalve {cell}.",
			explanation:
				"Zonder de {digit} in {cell} had elk cijfer precies twee plekken in elke rij, kolom en elk blok: een patroon dat nooit één oplossing heeft. Dus in {cell} komt een {digit}.",
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
		findingGrid: "Raster zoeken...",
		dragCorners:
			"Sleep de vier handvatten naar de hoeken van het sudokuraster.",
		cornerKeyboardHint:
			"Met het toetsenbord: tab naar een handvat en verplaats het met de pijltjestoetsen. Houd Shift ingedrukt voor grotere stappen.",
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
		verifyCellName: "Rij {row}, kolom {col}: {value}",
		verifyCellEmpty: "leeg",
		verifyCellUnknown: "onleesbaar cijfer",
		verifyCellNotes: "{type} {digits}",
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
		killer: {
			readingSums: "Kooisommen lezen {done}/{total}...",
			gridLabel: "Herkende kooien — tik op een vakje om de kooi te verbeteren",
			cellName: "Rij {row}, kolom {col}: kooi van {count}, som {sum}",
			cellNameNoSum: "Rij {row}, kolom {col}: kooi van {count}, nog geen som",
			unsureLines: {
				one: "{count} twijfelachtige kooilijn is geel gemarkeerd. Vergelijk hem met de foto.",
				other:
					"{count} twijfelachtige kooilijnen zijn geel gemarkeerd. Vergelijk ze met de foto.",
			},
			allLinesSure:
				"Elke kooilijn is duidelijk gelezen. Vergelijk de kooien toch even met de foto.",
			cageLabel: {
				one: "Kooi van {count} vakje",
				other: "Kooi van {count} vakjes",
			},
			sumLabel: "Som",
			sumHint: "Een heel getal van 1 tot 45.",
			linesLabel: "Kooilijnen rond dit vakje",
			lineUp: "Lijn boven",
			lineRight: "Lijn rechts",
			lineDown: "Lijn onder",
			lineLeft: "Lijn links",
			unsure: "twijfel",
			missingSums: {
				one: "{count} kooi heeft nog geen som.",
				other: "{count} kooien hebben nog geen som.",
			},
			invalidCages:
				"Een kooi kan niet kloppen: hij heeft meer dan 9 vakjes, of een som die zijn vakjes niet kunnen maken.",
			total: "De sommen tellen op tot {total}; bij een Killer is dat 405.",
			noSolution:
				"Deze kooien en sommen hebben geen oplossing. Vergelijk de sommen en lijnen met de foto.",
			manySolutions:
				"Deze kooien en sommen laten meer dan één oplossing toe. Vergelijk de sommen en lijnen met de foto.",
			readAsClassic: "Geen Killer? Lees hem als gewone sudoku",
			ready: "Kooien en sommen tellen op tot 405.",
		},
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

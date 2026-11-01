import type { quiz as enQuiz } from "../../en/games/quiz";

export const quiz = {
	phase: {
		lobby: "Lobby",
		question: "Vraag",
		reveal: "Onthulling",
		scoreboard: "Scorebord",
		finished: "Klaar",
	},
	questionNumber: "Vraag {number}",
	questionsCount: { one: "{count} vraag", other: "{count} vragen" },
	hostView: {
		joinCode: "Kamercode",
		joinCodePlaceholder: "------",
		playersInRoom: "{players} in de kamer",
		readyWhenYouAre: "Klaar als jij er klaar voor bent",
		questionProgress: "Vraag {current} van {total}",
		answersSubmitted: {
			one: "{count} antwoord ingediend",
			other: "{count} antwoorden ingediend",
		},
		advance: "Volgende",
		winnerHeading: "{name} wint!",
		quizComplete: "Quiz afgerond",
		pointsWon: "{points} punten",
		thanksForPlaying: "Bedankt voor het meespelen.",
		shareTextWinner:
			"Live quiz op Arcade Club — {name} heeft gewonnen met {points} punten ({count} spelers).",
		shareTextNoWinner:
			"Live quiz op Arcade Club — quiz afgerond ({count} spelers).",
		hostAnotherQuiz: "Host nog een quiz",
	},
	playerView: {
		joinNeeded: "Meedoen nodig",
		useRoomCodeFirst: "Gebruik eerst de kamercode",
		joinFromHomeNotice:
			"Doe mee via het startscherm zodat Arcade Club je antwoorden aan jouw plek kan koppelen.",
		youAreIn: "Je doet mee",
		waitingForHost: "Wachten op de host",
		firstQuestionNotice: "De eerste vraag verschijnt hier.",
		submitError: "Kon antwoord niet verzenden",
		answerLocked: "Antwoord vastgezet. Score: {score}",
	},
	setupForm: {
		intro:
			"Kies een vragenset, nodig spelers uit met een code en ga verder met vragen vanaf het hostscherm.",
		questionSetLabel: "Vragenset",
		builtIn: "Ingebouwd",
		starterQuizFallback: "Startquiz (voorbeeld)",
		wantOwnQuestions: "Wil je je eigen vragen gebruiken?",
		manageQuizSets: "Beheer quizsets",
		createRoomError: "Kon quizkamer niet aanmaken",
		creatingRoom: "Kamer aanmaken...",
		createQuizRoom: "Quizkamer aanmaken",
	},
	setEditor: {
		titleRequired: "Geef de quizset een titel",
		needsQuestion: "Voeg minstens één vraag toe",
		questionMissingPrompt: "Vraag {number} mist een vraagtekst",
		questionNeedsChoices:
			"Vraag {number} heeft minstens twee antwoordopties nodig",
		questionNeedsCorrectAnswer:
			"Vraag {number} heeft geen correct antwoord gemarkeerd",
		saveError: "Kon de quizset niet opslaan",
		titleLabel: "Titel",
		titlePlaceholder: "Vrijdagse teamquiz",
		descriptionLabel: "Beschrijving (optioneel)",
		descriptionPlaceholder: "10 vragen over het afgelopen kwartaal",
		importHeading: "Importeren vanuit spreadsheet",
		hideImport: "Verbergen",
		pasteRows: "Rijen plakken",
		importInstructionsBefore:
			"Kopieer rijen uit Excel/Sheets en plak ze hier. Kolommen: vraagtekst, 2-4 antwoordopties, correct antwoordnummer(s) zoals",
		importInstructionsBetween: "of",
		importInstructionsAfter: ", daarna optioneel seconden en punten.",
		importPlaceholder: "Wat is 2+2?\t3\t4\t5\t22\t2",
		importButton: "Vragen importeren",
		deleteQuestionAriaLabel: "Verwijder vraag {number}",
		promptPlaceholder: "Vraagtekst",
		correctAnswerTitle: "Correct antwoord",
		markAsCorrectTitle: "Markeer als correct",
		toggleChoiceAriaLabel: "Wissel antwoordoptie {number} correct",
		choicePlaceholder: "Antwoordoptie {number}",
		addChoice: "Antwoordoptie toevoegen",
		secondsLabel: "Seconden",
		pointsLabel: "Punten",
		addQuestion: "Vraag toevoegen",
		saving: "Opslaan...",
		saveChanges: "Wijzigingen opslaan",
		createQuizSet: "Quizset aanmaken",
	},
	scoreboard: {
		playersWillAppear: "Spelers verschijnen hier.",
		correctCount: "{count} correct",
	},
	sets: {
		heading: "Jouw quizsets",
		intro:
			"Bouw herbruikbare vragensets voor je quizkamers. Importeer vragen rechtstreeks vanuit een spreadsheet of schrijf ze hier.",
		newQuizSet: "Nieuwe quizset",
		mySets: "Mijn sets",
		noSetsYet:
			"Nog geen sets — maak er een aan of importeer vanuit een spreadsheet.",
		descriptionSuffix: " — {description}",
		editAriaLabel: "Bewerk {title}",
		deleteAriaLabel: "Verwijder {title}",
		deleteConfirm: 'Quizset "{title}" verwijderen?',
		builtInSets: "Ingebouwde sets",
		newSetTitle: "Nieuwe quizset",
		editSetTitle: "Quizset bewerken",
		loadingSet: "Quizset laden...",
		setNotFound: "Quizset niet gevonden.",
	},
	newPage: {
		heading: "Host een quizkamer",
		intro:
			"Maak een kamer aan, toon de toegangscode en laat spelers antwoorden vanaf hun eigen apparaat.",
	},
	status: {
		loading: "Quiz laden...",
		notFound: "Quiz niet gevonden.",
	},
} satisfies typeof enQuiz;

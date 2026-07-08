import type { common as enCommon } from "../en/common";

export const common = {
	header: {
		games: "Spellen",
		join: "Meedoen",
		dashboard: "Dashboard",
		switchLanguage: "Taal wijzigen naar {language}",
	},
	footer: {
		copyright: "© {year} Arcade Club.",
		about: "Over",
		tagline: "Live kamers, uitdagingslinks en toekomstige spelavonden.",
	},
	home: {
		kicker: "Arcade Club",
		title: "Start een kamer, deel een link, speel samen.",
		intro:
			"Live quizavonden, directe bordspeluitdagingen en een groeiend aanbod partyspellen voor je volgende call, klas of banksessie.",
	},
	about: {
		kicker: "Over",
		title: "Arcade Club",
		paragraph1:
			"Arcade Club is een plank vol party- en bordspellen die je in een paar seconden kunt starten en samen kunt spelen, waar je ook bent. Host een live quizavond, stuur een vriend een backgammon- of schaakuitdaging, race door een solo Sudoku, of verzamel een kamer voor Signal Words en Blufdobbelen.",
		paragraph2:
			"Alles draait rechtstreeks in de browser — niets te installeren. Maak een kamercode of deellink aan en spelers doen direct mee op hun eigen apparaat, ingelogd of als gast.",
	},
	actions: {
		start: "Start",
		cancel: "Annuleren",
		close: "Sluiten",
		save: "Opslaan",
		delete: "Verwijderen",
		copy: "Kopiëren",
		copied: "Gekopieerd!",
		retry: "Opnieuw proberen",
		back: "Terug",
		playAgain: "Opnieuw spelen",
		leave: "Verlaten",
	},
	session: {
		roomCode: "Kamercode",
		shareLink: "Deellink",
		waitingForPlayers: "Wachten op spelers…",
		players: { one: "{count} speler", other: "{count} spelers" },
		guest: "Gast",
		host: "Host",
		yourTurn: "Jij bent aan de beurt",
		spectating: "Meekijken",
	},
	errors: {
		somethingWentWrong: "Er ging iets mis. Probeer het opnieuw.",
		notFound: "Niet gevonden.",
		loading: "Laden…",
	},
} satisfies typeof enCommon;

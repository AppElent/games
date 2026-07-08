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

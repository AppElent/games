import type { common as en } from "../en/common";

export const common = {
	appName: "Arcade Club",
	actions: {
		cancel: "Annuleren",
		close: "Sluiten",
		continue: "Doorgaan",
		delete: "Verwijderen",
		done: "Klaar",
		retry: "Opnieuw proberen",
		share: "Delen",
		copy: "Kopiëren",
		copied: "Gekopieerd",
		start: "Starten",
		leave: "Verlaten",
		rematch: "Revanche",
		newGame: "Nieuw spel",
		signIn: "Inloggen",
	},
	session: {
		roomCode: "Kamercode",
		host: "Host",
		you: "Jij",
		guest: "Gast",
		players: { one: "{count} speler", other: "{count} spelers" },
		waitingForPlayers: "Wachten op spelers…",
		shareInvite: "Doe mee met mijn {game}-spel op Arcade Club: {link}",
		shareCode:
			"Doe mee met mijn {game}-spel op Arcade Club met kamercode {code}",
		notFound: "Dit spel is niet meer beschikbaar.",
		notSeated:
			"Dit toestel zit niet in dit spel. Doe opnieuw mee met de code of uitnodigingslink.",
	},
	tabs: {
		play: "Spelen",
		join: "Meedoen",
		profile: "Profiel",
	},
	states: {
		loading: "Laden…",
		offline: "Je bent offline. Online spellen hebben verbinding nodig.",
		somethingWentWrong: "Er ging iets mis. Probeer het opnieuw.",
	},
	hostGate: {
		heading: "Log in om te hosten",
		body: "Voor het hosten van een online spel heb je een account nodig. Je vrienden doen zonder account mee met een code of link.",
	},
	time: {
		justNow: "Zojuist",
		minutesAgo: {
			one: "{count} minuut geleden",
			other: "{count} minuten geleden",
		},
		hoursAgo: { one: "{count} uur geleden", other: "{count} uur geleden" },
		daysAgo: { one: "{count} dag geleden", other: "{count} dagen geleden" },
	},
} satisfies typeof en;

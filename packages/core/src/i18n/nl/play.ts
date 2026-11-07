import type { play as en } from "../en/play";

export const play = {
	subtitle: "Kies een spel.",
	continue: "Verder spelen",
	onlineGame: "Online spel",
	savedGame: "Opgeslagen spel",
	inLobby: "In de wachtkamer",
	inProgress: "Bezig",
	withPlayers: "Met {names}",
	code: "Code {code}",
	remove: "Verwijderen",
	removeOnlineTitle: "Uit Verder spelen halen?",
	removeOnlineBody:
		"Het spel zelf gaat door. Je kunt opnieuw meedoen met de code.",
	removeSavedTitle: "Dit opgeslagen spel verwijderen?",
	removeSavedBody: "Je voortgang in dit spel gaat verloren.",
	updateReady:
		"Er staat een nieuwe versie klaar. Herstart om hem te gebruiken.",
	restart: "Herstarten",
	taglines: {
		sudoku: "Klassiek, Killer en Binair. Werkt offline.",
		backgammon: "Samen op deze telefoon, of daag een vriend uit.",
		hitster: "Zet nummers op je tijdlijn. Host een feestkamer.",
		"card-games": "Pesten en Jokeren, tegen de computer of vrienden.",
	},
} satisfies typeof en;

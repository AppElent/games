import type { join as en } from "../en/join";

export const join = {
	title: "Meedoen",
	subtitle: "Vul de kamercode van het scherm of de uitnodiging van de host in.",
	code: "Kamercode",
	codePlaceholder: "ABC 123",
	name: "Jouw naam",
	openOnWeb: "Openen op het web",
	submit: "Meedoen",
	inviteTitle: "Je bent uitgenodigd",
	inviteBody: "Doe mee met het spel waarvoor je bent uitgenodigd.",
	unsupportedGame:
		"Dit is een {game}-spel, dat nog niet in de app zit. Open de uitnodiging op het web om te spelen.",
	error: "Meedoen lukte niet. Controleer de code en probeer opnieuw.",
} satisfies typeof en;

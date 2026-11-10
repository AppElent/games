import type { profile as en } from "../en/profile";

export const profile = {
	account: "Account",
	guestTitle: "Je speelt als gast",
	guestBody:
		"Solospellen worden op deze telefoon bewaard. Log in om online spellen te hosten.",
	signedInAs: "Ingelogd als {email}",
	signOut: "Uitloggen",
	deleteAccount: {
		action: "Account verwijderen",
		confirmTitle: "Je account verwijderen?",
		confirmBody:
			"Hiermee verwijder je definitief je Appelent-account, waarmee je ook inlogt bij andere Appelent-apps, samen met je Arcade Club-gegevens. Spellen die alleen jij speelde worden verwijderd; in spellen met anderen wordt je naam weggehaald. Dit kan niet ongedaan worden gemaakt.",
		confirm: "Definitief verwijderen",
		failed: "Je account kon niet worden verwijderd. Probeer het opnieuw.",
		unavailable: "Je account verwijderen is nu niet beschikbaar.",
	},
	displayName: "Weergavenaam",
	displayNameHint: "Andere spelers zien deze naam als je meedoet.",
	preferences: "Voorkeuren",
	appearance: "Weergave",
	appearanceOptions: { system: "Systeem", light: "Licht", dark: "Donker" },
	language: "Taal",
	languages: { en: "English", nl: "Nederlands" },
	about: "Over",
	version: "Versie {version}",
	runningBuild: "{channel} · zoals gebouwd",
	runningUpdate: "{channel} · update {id}",
} satisfies typeof en;

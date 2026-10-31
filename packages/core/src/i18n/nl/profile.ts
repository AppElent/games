import type { profile as en } from "../en/profile";

export const profile = {
	title: "Profiel",
	account: "Account",
	guestTitle: "Je speelt als gast",
	guestBody:
		"Solospellen worden op deze telefoon bewaard. Log in om online spellen te hosten.",
	signedInAs: "Ingelogd als {email}",
	signOut: "Uitloggen",
	displayName: "Weergavenaam",
	displayNameHint: "Andere spelers zien deze naam als je meedoet.",
	preferences: "Voorkeuren",
	appearance: "Weergave",
	appearanceOptions: { system: "Systeem", light: "Licht", dark: "Donker" },
	language: "Taal",
	languages: { en: "English", nl: "Nederlands" },
	about: "Over",
	version: "Versie {version}",
} satisfies typeof en;

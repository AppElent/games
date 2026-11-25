import type { profile as en } from "../en/profile";

export const profile = {
	account: "Account",
	accountMenu: "Accountmenu",
	guestTitle: "Je speelt als gast",
	guestBody:
		"Solospellen worden op deze telefoon bewaard. Log in om online spellen te hosten.",
	signedInAs: "Ingelogd als {email}",
	signOut: "Uitloggen",
	loading: "Laden…",
	profileTitle: "Profiel",
	email: "E-mail: {email}",
	saveProfile: "Profiel opslaan",
	session: "Sessie",
	name: {
		firstName: "Voornaam",
		lastName: "Achternaam",
		save: "Naam opslaan",
		saved: "Naam opgeslagen.",
		failed: "Je naam kon niet worden opgeslagen. Probeer het opnieuw.",
	},
	password: {
		action: "Wachtwoord wijzigen",
		title: "Wachtwoord wijzigen",
		signInAgain: "Opnieuw inloggen",
		current: "Huidig wachtwoord",
		new: "Nieuw wachtwoord",
		rules: "Minstens 8 tekens.",
		submit: "Wachtwoord wijzigen",
		changed: "Wachtwoord gewijzigd",
		changedBody:
			"Je andere apparaten zijn uitgelogd. Gebruik je nieuwe wachtwoord de volgende keer dat je inlogt.",
		failed: "Je wachtwoord kon niet worden gewijzigd. Probeer het opnieuw.",
		none: "Dit account logt in zonder wachtwoord, via een andere dienst of een gemailde code, dus er is geen wachtwoord om te wijzigen.",
	},
	accountPortal: {
		title: "AppElent-account",
		body: "Je login werkt in elke AppElent-app. Beheer daar je e-mailadressen, inlogmethoden, apparaten en tweestapsverificatie.",
		action: "Beheer je AppElent-account",
		newTab: "(opent in een nieuw tabblad)",
		failed: "Je AppElent-account kon niet worden geopend. Probeer het opnieuw.",
	},
	privacyFailed:
		"Het privacybeleid kon niet worden geopend. Probeer het opnieuw.",
	opensInBrowser: "Opent in de browser",
	exportData: {
		title: "Je gegevens",
		body: "Download alles wat Arcade Club over je account bewaart als JSON-bestand: je spellen, plaatsen, antwoorden en inhoud. Namen van andere spelers staan er niet in.",
		action: "Mijn gegevens downloaden",
		exporting: "Bezig met voorbereiden…",
		failed: "Je gegevens konden niet worden gedownload. Probeer het opnieuw.",
	},
	reverify: {
		title: "Bevestig dat jij het bent",
		endedTitle: "Bevestigen is niet gelukt",
		delete: {
			passwordBody:
				"Vul je wachtwoord in om te verwijderen. Zo kan niemand anders op dit apparaat je gegevens of account verwijderen.",
			submit: "Bevestigen en verwijderen",
		},
		changePassword: {
			passwordBody:
				"Vul je huidige wachtwoord nog een keer in om het te wijzigen. Zo kan niemand anders op dit apparaat je account overnemen.",
			submit: "Bevestigen en wachtwoord wijzigen",
		},
		emailCode: "Mail me in plaats daarvan een code",
		usePassword: "Toch mijn wachtwoord gebruiken",
		codeBody: "Vul de 6-cijferige code in die we naar {email} mailen.",
	},
	deleteAccount: {
		action: "Account verwijderen",
		chooseTitle: "Wat wil je verwijderen?",
		chooseBody:
			"Met je AppElent-login log je in bij Gather, Foundry, Fairway en Arcade Club.",
		continue: "Doorgaan",
		app: {
			label: "Alleen Arcade Club-gegevens verwijderen",
			detail:
				"Je spellen, plaatsen, antwoorden en inhoud in Arcade Club. Je AppElent-login blijft, dus Gather, Foundry en Fairway blijven werken.",
			confirmTitle: "Je Arcade Club-gegevens verwijderen?",
			confirmBody:
				"Spellen die alleen jij speelde worden verwijderd; in spellen met anderen wordt je naam weggehaald. Je wordt op dit apparaat uitgelogd. Je AppElent-login blijft werken in Gather, Foundry en Fairway, en als je hier opnieuw inlogt, begin je met een leeg profiel. Dit kan niet ongedaan worden gemaakt.",
			confirm: "Arcade Club-gegevens verwijderen",
			doneTitle: "Je Arcade Club-gegevens zijn verwijderd",
			doneBody:
				"Je AppElent-login werkt nog in Gather, Foundry en Fairway. Log hier op elk moment opnieuw in om opnieuw te beginnen.",
		},
		account: {
			label: "Mijn hele AppElent-account verwijderen",
			detail:
				"Verwijdert ook je AppElent-login en je gegevens in Gather, Foundry, Fairway en Arcade Club.",
			confirmTitle: "Je hele AppElent-account verwijderen?",
			confirmBody:
				"Hiermee verwijder je definitief je AppElent-login, waarmee je inlogt bij Gather, Foundry, Fairway en Arcade Club, en je gegevens in alle vier de apps. In Arcade Club worden spellen die alleen jij speelde verwijderd; in spellen met anderen wordt je naam weggehaald. Dit kan niet ongedaan worden gemaakt.",
			confirm: "Definitief verwijderen",
		},
		deleting: "Bezig met verwijderen…",
		failed: "Je gegevens konden niet worden verwijderd. Probeer het opnieuw.",
		unavailable:
			"Je hele AppElent-account verwijderen is nu niet beschikbaar. Je kunt je Arcade Club-gegevens wel verwijderen.",
		signInAgain: "Opnieuw inloggen",
	},
	displayName: "Weergavenaam",
	displayNameHint: "Andere spelers zien deze naam als je meedoet.",
	preferences: "Voorkeuren",
	appearance: "Weergave",
	appearanceOptions: { system: "Systeem", light: "Licht", dark: "Donker" },
	appearanceBody: "Kies hoe {appName} eruitziet. Systeem volgt je apparaat.",
	language: "Taal",
	languages: { en: "English", nl: "Nederlands" },
	about: "Over",
	version: "Versie {version}",
	versionWithBuild: "Versie {version} ({build})",
	update: "update {label}",
	noUpdate: "geen update",
} satisfies typeof en;

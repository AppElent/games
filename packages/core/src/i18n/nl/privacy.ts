import type { privacy as enPrivacy } from "../en/privacy";

export const privacy = {
	title: "Privacybeleid",
	updated: "Laatst bijgewerkt: 10 november 2026",
	intro:
		"Arcade Club is een verzameling party-, kaart- en bordspellen voor het web en iOS, gemaakt door Appelent. Dit beleid legt uit welke gegevens we verzamelen als je speelt, waarom, en wat je ermee kunt doen.",
	sections: {
		collect: {
			heading: "Wat we verzamelen",
			paragraphs: {
				account:
					"Account: als je een account aanmaakt, je e-mailadres, een wachtwoord (versleuteld opgeslagen door onze inlogdienst) en je inlogsessies. Dit is een Appelent-account, waarmee je ook bij andere Appelent-apps inlogt.",
				play: "Spelen: de naam die je kiest, de kamers en spellen die je host of waar je aan meedoet, en je zetten en scores, zodat iedereen aan tafel hetzelfde spel ziet.",
				guest:
					"Gasten: spelen zonder account gebruikt een willekeurige code die op je apparaat wordt gemaakt, plus de naam die je invult.",
				device:
					"Je apparaat: solospellen, opgeslagen puzzels en instellingen blijven op je apparaat en worden niet naar ons gestuurd.",
				diagnostics:
					"Diagnose: crash- en foutrapporten (apparaatmodel, besturingssysteem en appversie, wat er misging) en een probleemmelding die je zelf verstuurt. Deze bevatten geen accountgegevens.",
			},
		},
		use: {
			heading: "Waarvoor we het gebruiken",
			paragraphs: {
				purpose:
					"We gebruiken deze gegevens alleen om de spellen te laten werken: om je in te loggen, je naam te tonen aan de spelers in je kamer, spellen gelijk te houden en fouten op te lossen. We verkopen je gegevens niet, tonen geen advertenties en volgen je niet in andere apps en websites.",
				camera:
					"De iOS-app gebruikt de camera alleen als je een QR-code van een uitnodiging scant. Beelden worden op je apparaat verwerkt en nooit opgeslagen of verstuurd.",
			},
		},
		share: {
			heading: "Wie het verwerkt",
			paragraphs: {
				providers:
					"We gebruiken een paar dienstverleners die gegevens namens ons verwerken: Clerk (accounts en inloggen, VS), Convex (spelserver, EU), Cloudflare (webhosting) en Sentry (foutrapporten, VS). Doorgifte buiten de EU valt onder de standaardcontractbepalingen van deze diensten.",
				links:
					"Muziektijdlijn kan een nummer opzoeken op Spotify. Wat daar gebeurt, valt onder het privacybeleid van Spotify.",
			},
		},
		retention: {
			heading: "Hoe lang we het bewaren",
			paragraphs: {
				account:
					"Accountgegevens blijven bewaard tot je je account verwijdert. Foutrapporten worden binnen 90 dagen verwijderd.",
				games:
					"Afgelopen spellen blijven bestaan, zodat andere spelers hun geschiedenis houden. Verwijder je je account, dan halen we je naam uit die spellen.",
			},
		},
		rights: {
			heading: "Je keuzes en rechten",
			paragraphs: {
				delete:
					"Je kunt je account en je gegevens op elk moment verwijderen op de Account-pagina van de website, in de iOS-app via Profiel → Account verwijderen, of door ons te mailen. Daarmee verwijder je je Appelent-account voor alle Appelent-apps.",
				gdpr: "Je kunt ons vragen om een kopie van je gegevens, ze te corrigeren of te verwijderen, of bezwaar maken tegen het gebruik ervan, via privacy@appelent.nl. Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.",
				children:
					"Arcade Club is niet bedoeld voor kinderen jonger dan 13 en we verzamelen niet bewust hun persoonsgegevens.",
			},
		},
		contact: {
			heading: "Contact",
			paragraphs: {
				email:
					"Vragen over dit beleid of je gegevens: privacy@appelent.nl. Als we dit beleid wijzigen, passen we de datum hierboven aan.",
			},
		},
	},
} satisfies typeof enPrivacy;

import type { auth as en } from "../en/auth";

export const auth = {
	signIn: {
		title: "Inloggen",
		subtitle: "Host online spellen en houd je naam op al je toestellen.",
		email: "E-mail",
		password: "Wachtwoord",
		submit: "Inloggen",
		emailCode: "Mail me een inlogcode",
		emailFirst: "Vul eerst je e-mailadres in.",
		forgotPassword: "Wachtwoord vergeten?",
		noAccount: "Nieuw hier?",
		createAccount: "Account aanmaken",
		devNote: "Testaccount ingevuld (ontwikkelomgeving).",
		unsupportedStep:
			"Inloggen vraagt een extra stap die deze app nog niet ondersteunt. Gebruik de webapp.",
	},
	signInCode: {
		title: "Check je e-mail",
		body: "We hebben een code van 6 cijfers gestuurd naar {email}.",
		code: "Code",
		submit: "Inloggen",
		resend: "Stuur een nieuwe code",
		resent: "Er komt een nieuwe code aan.",
		differentEmail: "Ander e-mailadres gebruiken",
	},
	signUp: {
		title: "Account aanmaken",
		subtitle:
			"Kies een e-mailadres en wachtwoord. Zonder account speel je als gast.",
		firstName: "Voornaam",
		submit: "Account aanmaken",
		haveAccount: "Heb je al een account?",
	},
	verifyEmail: {
		title: "Bevestig je e-mail",
		body: "Vul de code van 6 cijfers in die we naar {email} stuurden.",
		submit: "Bevestigen",
	},
	reset: {
		title: "Wachtwoord herstellen",
		body: "We mailen je een code om een nieuw wachtwoord te kiezen.",
		sendCode: "Code versturen",
		codeBody:
			"Vul de code in die we naar {email} stuurden en kies een nieuw wachtwoord.",
		newPassword: "Nieuw wachtwoord",
		submit: "Wachtwoord instellen",
	},
	errors: {
		generic: "Er ging iets mis. Probeer het opnieuw.",
		identifierNotFound: "Geen account gevonden met dat e-mailadres.",
		passwordIncorrect: "Dat wachtwoord klopt niet.",
		identifierExists: "Er bestaat al een account met dat e-mailadres.",
		emailInvalid: "Vul een geldig e-mailadres in.",
		required: "Dit veld is verplicht.",
		passwordTooShort: "Dat wachtwoord is te kort.",
		passwordPwned: "Dat wachtwoord komt voor in een datalek. Kies een ander.",
		passwordDoesNotMeetRequirements: "Dat wachtwoord is niet sterk genoeg.",
		codeIncorrect: "Die code klopt niet.",
		codeExpired: "Die code is verlopen. Vraag een nieuwe aan.",
		tooManyRequests: "Te veel pogingen. Probeer het zo opnieuw.",
		network: "Netwerkfout. Controleer je verbinding en probeer opnieuw.",
	},
} satisfies typeof en;

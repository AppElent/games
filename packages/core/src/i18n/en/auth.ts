export const auth = {
	signIn: {
		title: "Sign in",
		subtitle: "Host online games and keep your name across devices.",
		email: "Email",
		password: "Password",
		submit: "Sign in",
		busy: "Please wait…",
		emailCode: "Email me a sign-in code",
		emailFirst: "Enter your email first.",
		forgotPassword: "Forgot password?",
		noAccount: "New here?",
		createAccount: "Create an account",
		devNote: "Test account prefilled (development instance).",
		unsupportedStep:
			'Sign-in needs another step this app doesn\'t support. Try "Forgot password?" to set a new password.',
	},
	signInCode: {
		title: "Check your email",
		body: "We sent a 6-digit code to {email}.",
		code: "Code",
		submit: "Sign in",
		resend: "Send a new code",
		resent: "A new code is on its way.",
		differentEmail: "Use a different email",
	},
	secondFactor: {
		title: "Verify it's you",
		prompt: {
			totp: "Enter the 6-digit code from your authenticator app.",
			phone_code: "We texted a 6-digit code to {destination}.",
			email_code: "We sent a 6-digit code to {destination}.",
			backup_code: "Enter one of the backup codes you saved.",
		},
		yourPhone: "your phone",
		yourEmail: "your email",
		backupCode: "Backup code",
		submit: "Verify",
		switchTo: {
			totp: "Use your authenticator app",
			phone_code: "Text a code to {destination}",
			email_code: "Email a code to {destination}",
			backup_code: "Use a backup code",
		},
		passwordChanged: "Your password is changed. One more step to sign in.",
		methodLocked:
			"Too many wrong codes for this method. Use another one below, or go back and sign in again.",
		onlyMethodLocked: "Too many wrong codes. Go back and sign in again.",
		attemptEnded:
			"This sign-in took too long and can't continue. Go back and sign in again.",
		noMethod:
			"Arcade Club can't do your account's second step. It accepts a code from an authenticator app, a text message or an email, or a backup code. Email privacy@appelent.nl for help. You can keep playing as a guest.",
		backToSignIn: "Back to sign in",
	},
	signUp: {
		title: "Create an account",
		subtitle:
			"Pick an email and password. You can play as a guest without one.",
		firstName: "First name",
		submit: "Create account",
		haveAccount: "Already have an account?",
	},
	verifyEmail: {
		title: "Verify your email",
		body: "Enter the 6-digit code we sent to {email}.",
		submit: "Verify",
	},
	reset: {
		title: "Reset password",
		body: "We'll email you a code to choose a new password.",
		sendCode: "Send code",
		codeBody: "Enter the code we sent to {email} and choose a new password.",
		newPassword: "New password",
		submit: "Set password",
	},
	errors: {
		generic: "Something went wrong. Please try again.",
		identifierNotFound: "No account found with that email.",
		passwordIncorrect: "That password is not right.",
		noPassword:
			'This account has no password. Use "Email me a sign-in code" instead.',
		identifierExists: "An account with that email already exists.",
		emailInvalid: "Enter a valid email address.",
		required: "This field is required.",
		passwordTooShort: "That password is too short.",
		passwordPwned:
			"That password has appeared in a data breach. Choose another.",
		passwordDoesNotMeetRequirements: "That password is not strong enough.",
		codeIncorrect: "That code is not right.",
		codeExpired: "That code has expired. Send a new one.",
		codeAttemptsExceeded: "Too many wrong codes. Send a new one.",
		tooManyRequests: "Too many attempts. Try again in a moment.",
		accountLocked:
			"This account is temporarily locked after too many failed attempts. Try again later.",
		network: "Network error. Check your connection and try again.",
		tooLong: "That is too long.",
		signInAgain: "For your security, sign in again first, then try once more.",
		unsupportedStep:
			"Signing in to this account needs another step this page doesn't support yet.",
	},
	lockout: {
		body: "This account is temporarily locked after too many failed attempts. Try again in {duration}.",
		seconds: { one: "{count} second", other: "{count} seconds" },
		minutes: { one: "{count} minute", other: "{count} minutes" },
		hours: { one: "{count} hour", other: "{count} hours" },
	},
};

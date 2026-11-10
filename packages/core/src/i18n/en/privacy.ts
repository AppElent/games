/**
 * The privacy policy shown at `/privacy` on the web and linked from the app's
 * Profile tab and App Store Connect. Sections render in key order.
 */
export const privacy = {
	title: "Privacy policy",
	updated: "Last updated: 10 November 2026",
	intro:
		"Arcade Club is a collection of party, card and board games for the web and iOS, run by Appelent. This policy explains what we collect when you play, why, and what you can do about it.",
	sections: {
		collect: {
			heading: "What we collect",
			paragraphs: {
				account:
					"Account: if you create an account, your email address, a password (stored hashed by our sign-in provider) and your sign-in sessions. This is an Appelent account, which also signs you in to other Appelent apps.",
				play: "Play: the display name you choose, the rooms and games you host or join, and your moves and scores, so everyone at the table sees the same game.",
				guest:
					"Guests: playing without an account uses a random identifier created on your device, plus the display name you enter.",
				device:
					"Your device: solo games, saved puzzles and settings stay on your device and are not sent to us.",
				diagnostics:
					"Diagnostics: crash and error reports (device model, OS and app version, what went wrong) and any problem report you choose to send. These contain no account details.",
			},
		},
		use: {
			heading: "How we use it",
			paragraphs: {
				purpose:
					"We use this data only to run the games: to sign you in, show your name to the players in your room, keep games in sync and fix bugs. We do not sell your data, show ads or track you across other apps and websites.",
				camera:
					"The iOS app uses the camera only when you scan an invite QR code. Images are processed on your device and never stored or uploaded.",
			},
		},
		share: {
			heading: "Who processes it",
			paragraphs: {
				providers:
					"We rely on a few service providers that process data on our behalf: Clerk (accounts and sign-in, USA), Convex (game backend, EU), Cloudflare (web hosting) and Sentry (error reports, USA). Transfers outside the EU are covered by these providers' standard contractual clauses.",
				links:
					"Music Timeline can open a song search on Spotify. What happens there is governed by Spotify's own privacy policy.",
			},
		},
		retention: {
			heading: "How long we keep it",
			paragraphs: {
				account:
					"Account data stays until you delete your account. Error reports are deleted within 90 days.",
				games:
					"Finished games stay so other players keep their history. When you delete your account, your name is removed from those games.",
			},
		},
		rights: {
			heading: "Your choices and rights",
			paragraphs: {
				delete:
					"You can delete your account and its data at any time in the iOS app under Profile → Delete account, or by emailing us. This deletes your Appelent account for every Appelent app.",
				gdpr: "You may ask for a copy of your data, its correction or deletion, or object to its use, by emailing privacy@appelent.nl. You can also complain to your local data protection authority; in the Netherlands, the Autoriteit Persoonsgegevens.",
				children:
					"Arcade Club is not directed at children under 13 and we do not knowingly collect their personal data.",
			},
		},
		contact: {
			heading: "Contact",
			paragraphs: {
				email:
					"Questions about this policy or your data: privacy@appelent.nl. If we change this policy, we update the date above.",
			},
		},
	},
};

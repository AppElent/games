import type { wordLinks as enWordLinks } from "../../en/games/wordLinks";

export const wordLinks = {
	game: {
		intro: "Vind vier groepen van vier.",
		dailyNotice: "Dagpuzzel van vandaag.",
		practiceNotice: "Oefenpuzzel.",
		mistakesRemainingSr: "Fouten resterend: ",
		solved: "Opgelost! 🎉",
		correct: "Klopt!",
		oneAway: "Net niet...",
		notAGroup: "Geen groep.",
		duplicateGuess: "Die combinatie heb je al geprobeerd.",
		outOfGuesses: "Geen pogingen meer — de groepen worden hieronder getoond.",
		copyError: "Kon niet kopiëren — selecteer en kopieer handmatig.",
		submit: "Bevestigen",
		shuffle: "Schudden",
		deselect: "Deselecteren",
	},
	page: {
		dailyHeading: "Dagpuzzel",
		streakLabel: "🔥 Reeks: {count}",
		practiceLink: "Oefenen",
		dailyLink: "Dagpuzzel",
		noPuzzle: "Geen puzzel.",
		puzzleNotFound: "Puzzel niet gevonden.",
		backToDaily: "Terug naar de dagpuzzel",
		practicePuzzleFallback: "Oefenpuzzel",
	},
} satisfies typeof enWordLinks;

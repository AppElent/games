/**
 * One reading of a glyph from two: Apple Vision's, which is surest of print,
 * and the digit network's, which also reads handwriting.
 */
import type { DigitRead } from "@arcadeclub/core/sudoku-scan-ink";
import type { DigitGuess } from "./digit-net";

/** Ink the network is this sure is no digit, and Vision reads nothing in. */
const JUNK = 0.8;
/** The share of Vision's confidence at which the network is believed instead. */
const NETWORK_SHARE = 0.9;
/** Two readings that differ stay this doubtful: the player checks them. */
const DOUBTFUL = 0.6;
/** Vision reads a glyph repeated on a line; a line of 6s turned is a line of 9s. */
const TURNED = [6, 9];

export function fuseReads(vision: DigitRead, guess: DigitGuess): DigitRead {
	if (vision.digit === 0) {
		if (guess.junk >= JUNK) return vision;
		return { digit: guess.digit, confidence: guess.confidence };
	}
	if (vision.digit === guess.digit) {
		return {
			digit: vision.digit,
			confidence: Math.max(vision.confidence, guess.confidence),
		};
	}
	const turned = TURNED.includes(vision.digit) && TURNED.includes(guess.digit);
	const network =
		turned || guess.confidence >= vision.confidence * NETWORK_SHARE;
	return {
		digit: network ? guess.digit : vision.digit,
		confidence: DOUBTFUL,
	};
}

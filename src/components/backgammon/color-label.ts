import type { BackgammonColor } from "@arcadeclub/core/backgammon";

/**
 * A side's name. Messages hold it twice, as a word inside a sentence
 * (`board`) and as a standalone label (`localPlay`): pass the group that fits.
 */
export function colorLabel(
	words: { colorWhite: string; colorBlack: string },
	color: BackgammonColor,
): string {
	return color === "white" ? words.colorWhite : words.colorBlack;
}

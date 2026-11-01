import type { BackgammonColor } from "@arcadeclub/core/backgammon";
import type { Messages } from "../../../i18n";

/** "White"/"Black" as a standalone word (headings, "You are playing …"). */
export function colorLabel(
	copy: Messages["games"]["backgammon"],
	color: BackgammonColor,
): string {
	return color === "white"
		? copy.localPlay.colorWhite
		: copy.localPlay.colorBlack;
}

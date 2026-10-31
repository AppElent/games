import type { Messages } from "./en";
import { auth } from "./nl/auth";
import { backgammon } from "./nl/backgammon";
import { common } from "./nl/common";
import { hitster } from "./nl/hitster";
import { join } from "./nl/join";
import { play } from "./nl/play";
import { profile } from "./nl/profile";
import { sudoku } from "./nl/sudoku";

export const nl: Messages = {
	common,
	auth,
	play,
	join,
	profile,
	sudoku,
	backgammon,
	hitster,
};

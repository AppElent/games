import { auth } from "./en/auth";
import { backgammon } from "./en/backgammon";
import { common } from "./en/common";
import { hitster } from "./en/hitster";
import { join } from "./en/join";
import { play } from "./en/play";
import { profile } from "./en/profile";
import { sudoku } from "./en/sudoku";

export const en = {
	common,
	auth,
	play,
	join,
	profile,
	sudoku,
	backgammon,
	hitster,
};

export type Messages = typeof en;

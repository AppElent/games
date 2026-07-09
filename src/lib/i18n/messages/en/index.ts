import { catalog } from "./catalog";
import { common } from "./common";
import { backgammon } from "./games/backgammon";
import { quiz } from "./games/quiz";
import { sudoku } from "./games/sudoku";

export const en = {
	common,
	catalog,
	games: { quiz, backgammon, sudoku },
};

export type Messages = typeof en;

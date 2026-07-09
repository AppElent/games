import { catalog } from "./catalog";
import { common } from "./common";
import { backgammon } from "./games/backgammon";
import { chess } from "./games/chess";
import { connectFour } from "./games/connectFour";
import { quiz } from "./games/quiz";
import { sudoku } from "./games/sudoku";

export const en = {
	common,
	catalog,
	games: { quiz, backgammon, sudoku, chess, connectFour },
};

export type Messages = typeof en;

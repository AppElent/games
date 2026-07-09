import type { Messages } from "../en";
import { catalog } from "./catalog";
import { common } from "./common";
import { backgammon } from "./games/backgammon";
import { chess } from "./games/chess";
import { connectFour } from "./games/connectFour";
import { hitster } from "./games/hitster";
import { quiz } from "./games/quiz";
import { signalWords } from "./games/signalWords";
import { sudoku } from "./games/sudoku";
import { wordLinks } from "./games/wordLinks";

export const nl = {
	common,
	catalog,
	games: {
		quiz,
		backgammon,
		sudoku,
		chess,
		connectFour,
		hitster,
		wordLinks,
		signalWords,
	},
} satisfies Messages;

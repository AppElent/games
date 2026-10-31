import { auth } from "./auth";
import { catalog } from "./catalog";
import { common } from "./common";
import { backgammon } from "./games/backgammon";
import { bluffDice } from "./games/bluffDice";
import { chess } from "./games/chess";
import { connectFour } from "./games/connectFour";
import { hitster } from "./games/hitster";
import { quiz } from "./games/quiz";
import { signalWords } from "./games/signalWords";
import { squadSurge } from "./games/squadSurge";
import { sudoku } from "./games/sudoku";
import { wordLinks } from "./games/wordLinks";
import { play } from "./play";
import { profile } from "./profile";

export const en = {
	common,
	catalog,
	auth,
	play,
	profile,
	games: {
		quiz,
		backgammon,
		sudoku,
		chess,
		connectFour,
		hitster,
		wordLinks,
		signalWords,
		bluffDice,
		squadSurge,
	},
};

export type Messages = typeof en;

import { catalog } from "./catalog";
import { common } from "./common";
import { backgammon } from "./games/backgammon";
import { quiz } from "./games/quiz";

export const en = {
	common,
	catalog,
	games: { quiz, backgammon },
};

export type Messages = typeof en;

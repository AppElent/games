import type { Messages } from "../en";
import { catalog } from "./catalog";
import { common } from "./common";
import { backgammon } from "./games/backgammon";
import { quiz } from "./games/quiz";

export const nl = {
	common,
	catalog,
	games: { quiz, backgammon },
} satisfies Messages;

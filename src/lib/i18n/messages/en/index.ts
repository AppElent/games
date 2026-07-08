import { catalog } from "./catalog";
import { common } from "./common";
import { quiz } from "./games/quiz";

export const en = {
	common,
	catalog,
	games: { quiz },
};

export type Messages = typeof en;

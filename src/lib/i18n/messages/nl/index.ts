import type { Messages } from "../en";
import { catalog } from "./catalog";
import { common } from "./common";
import { quiz } from "./games/quiz";

export const nl = {
	common,
	catalog,
	games: { quiz },
} satisfies Messages;

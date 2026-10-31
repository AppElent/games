import { auth } from "./en/auth";
import { common } from "./en/common";
import { join } from "./en/join";
import { play } from "./en/play";
import { profile } from "./en/profile";
import { sudoku } from "./en/sudoku";

export const en = { common, auth, play, join, profile, sudoku };

export type Messages = typeof en;

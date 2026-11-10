/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as backgammon from "../backgammon.js";
import type * as bluffDice from "../bluffDice.js";
import type * as cardGames from "../cardGames.js";
import type * as chess from "../chess.js";
import type * as connectFour from "../connectFour.js";
import type * as hitster from "../hitster.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_cardSeats from "../lib/cardSeats.js";
import type * as lib_codes from "../lib/codes.js";
import type * as lib_duel from "../lib/duel.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_gameSession from "../lib/gameSession.js";
import type * as lib_hostedSession from "../lib/hostedSession.js";
import type * as lib_join from "../lib/join.js";
import type * as lib_validators from "../lib/validators.js";
import type * as quiz from "../quiz.js";
import type * as sessions from "../sessions.js";
import type * as signalWords from "../signalWords.js";
import type * as sudoku from "../sudoku.js";
import type * as workbench from "../workbench.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  backgammon: typeof backgammon;
  bluffDice: typeof bluffDice;
  cardGames: typeof cardGames;
  chess: typeof chess;
  connectFour: typeof connectFour;
  hitster: typeof hitster;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/auth": typeof lib_auth;
  "lib/cardSeats": typeof lib_cardSeats;
  "lib/codes": typeof lib_codes;
  "lib/duel": typeof lib_duel;
  "lib/errors": typeof lib_errors;
  "lib/gameSession": typeof lib_gameSession;
  "lib/hostedSession": typeof lib_hostedSession;
  "lib/join": typeof lib_join;
  "lib/validators": typeof lib_validators;
  quiz: typeof quiz;
  sessions: typeof sessions;
  signalWords: typeof signalWords;
  sudoku: typeof sudoku;
  workbench: typeof workbench;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

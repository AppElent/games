/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as backgammon from "../backgammon.js";
import type * as chess from "../chess.js";
import type * as hitster from "../hitster.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_codes from "../lib/codes.js";
import type * as quiz from "../quiz.js";
import type * as sessions from "../sessions.js";
import type * as sudoku from "../sudoku.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  backgammon: typeof backgammon;
  chess: typeof chess;
  hitster: typeof hitster;
  "lib/auth": typeof lib_auth;
  "lib/codes": typeof lib_codes;
  quiz: typeof quiz;
  sessions: typeof sessions;
  sudoku: typeof sudoku;
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

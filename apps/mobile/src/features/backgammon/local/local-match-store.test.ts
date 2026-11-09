import {
	createInitialBackgammonState,
	withBackgammonDice,
} from "@arcadeclub/core/backgammon";
import {
	DEFAULT_BACKGAMMON_OPTIONS,
	type LocalMatch,
	newLocalMatch,
} from "@arcadeclub/core/backgammon-local";
import {
	readText,
	STORAGE_KEYS,
	writeText,
} from "../../../storage/local-store";
import {
	clearLocalMatch,
	hubOffersContinue,
	playHomeListsMatch,
	readLocalMatch,
	resumableItems,
	startNewLocalMatch,
	writeLocalMatch,
} from "./local-match-store";

const fresh = newLocalMatch(1);
const rolled: LocalMatch = {
	...fresh,
	state: withBackgammonDice(fresh.state, [3, 4]),
};
const moved: LocalMatch = { ...fresh, history: [fresh.state] };
const won: LocalMatch = {
	...moved,
	state: { ...fresh.state, off: { white: 15, black: 0 } },
};

describe("local match store", () => {
	beforeEach(() => clearLocalMatch());

	it("persists the match", () => {
		const match = newLocalMatch(1);
		writeLocalMatch(match);
		expect(readLocalMatch()).toEqual(match);
		clearLocalMatch();
		expect(readLocalMatch()).toBeNull();
	});

	it("keeps the exact bytes it wrote", () => {
		writeLocalMatch(moved);
		expect(readText(STORAGE_KEYS.backgammonLocal)).toBe(JSON.stringify(moved));
	});

	it.each<[string, unknown]>([
		["bad JSON", "{not json"],
		["no state", JSON.stringify({ history: [], future: [] })],
		[
			"a board with no counters",
			JSON.stringify({
				...fresh,
				state: { ...fresh.state, off: undefined },
			}),
		],
		[
			"no dice",
			JSON.stringify({ ...fresh, state: { ...fresh.state, dice: 3 } }),
		],
		["no timestamp", JSON.stringify({ ...fresh, updatedAt: undefined })],
	])("reads %s as no match", (_name, raw) => {
		writeText(STORAGE_KEYS.backgammonLocal, raw as string);
		expect(readLocalMatch()).toBeNull();
		expect(resumableItems()).toEqual([]);
	});

	it("starts a new match on the default options", () => {
		writeLocalMatch({
			...moved,
			options: { ...DEFAULT_BACKGAMMON_OPTIONS, showNumbers: true },
		});
		startNewLocalMatch();
		const match = readLocalMatch();
		expect(match?.history).toEqual([]);
		expect(match?.state).toEqual(createInitialBackgammonState());
		expect(match?.options).toEqual(DEFAULT_BACKGAMMON_OPTIONS);
	});

	describe("what counts as worth continuing", () => {
		it("differs between the hub and the Play tab after a roll with no move", () => {
			expect(hubOffersContinue(rolled)).toBe(true);
			expect(playHomeListsMatch(rolled)).toBe(false);
		});

		it("agrees on a fresh, a played and a won match", () => {
			expect([hubOffersContinue(fresh), playHomeListsMatch(fresh)]).toEqual([
				false,
				false,
			]);
			expect([hubOffersContinue(moved), playHomeListsMatch(moved)]).toEqual([
				true,
				true,
			]);
			expect([hubOffersContinue(won), playHomeListsMatch(won)]).toEqual([
				false,
				false,
			]);
		});
	});

	it("offers a played match to resume, removing it deletes the match", () => {
		writeLocalMatch(rolled);
		expect(resumableItems()).toEqual([]);
		writeLocalMatch(moved);
		const [item] = resumableItems();
		expect(item).toMatchObject({
			id: "backgammon:local",
			gameType: "backgammon",
			href: "/backgammon/local",
			updatedAt: 1,
		});
		item.remove();
		expect(readLocalMatch()).toBeNull();
	});
});

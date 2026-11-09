import Storage from "expo-sqlite/kv-store";
import {
	readJson,
	readText,
	remove,
	STORAGE_KEYS,
	writeJson,
	writeText,
} from "./local-store";

const KEY = "test:key";
const isName = (value: unknown) => (typeof value === "string" ? value : null);

describe("local store", () => {
	beforeEach(() => remove(KEY));

	it("keeps the keys installed apps already hold", () => {
		expect(STORAGE_KEYS).toMatchObject({
			locale: "arcade:locale",
			appearance: "arcade:appearance",
			guest: "arcade:guest",
			displayName: "arcade:display-name",
			seats: "arcade:seats",
			backgammonLocal: "arcade:backgammon:local",
			sudokuIndex: "arcade:sudoku:index",
		});
		expect(STORAGE_KEYS.sudokuSave("abc")).toBe("arcade:sudoku:save:abc");
	});

	it("stores text as is and JSON as JSON.stringify writes it", () => {
		writeText(KEY, "dark");
		expect(readText(KEY)).toBe("dark");
		writeJson(KEY, { a: 1 });
		expect(readText(KEY)).toBe('{"a":1}');
	});

	it("reads back through the parser", () => {
		writeJson(KEY, "Ana");
		expect(readJson(KEY, isName)).toBe("Ana");
	});

	it("reads nothing saved, removed and empty values as null", () => {
		expect(readJson(KEY, isName)).toBeNull();
		writeJson(KEY, "Ana");
		remove(KEY);
		expect(readJson(KEY, isName)).toBeNull();
		writeText(KEY, "");
		expect(readJson(KEY, isName)).toBeNull();
	});

	it("degrades bad JSON, a rejected shape and a throwing parser to null", () => {
		writeText(KEY, "{not json");
		expect(readJson(KEY, isName)).toBeNull();
		writeJson(KEY, 12);
		expect(readJson(KEY, isName)).toBeNull();
		expect(
			readJson(KEY, () => {
				throw new Error("bad save");
			}),
		).toBeNull();
	});

	it("survives a store that throws", () => {
		const fail = () => {
			throw new Error("locked");
		};
		const spies = [
			jest.spyOn(Storage, "getItemSync").mockImplementation(fail),
			jest.spyOn(Storage, "setItemSync").mockImplementation(fail),
			jest.spyOn(Storage, "removeItemSync").mockImplementation(fail),
		];
		expect(readText(KEY)).toBeNull();
		expect(readJson(KEY, isName)).toBeNull();
		expect(() => writeJson(KEY, 1)).not.toThrow();
		expect(() => remove(KEY)).not.toThrow();
		for (const spy of spies) spy.mockRestore();
	});
});

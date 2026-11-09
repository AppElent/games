// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	readJson,
	readTabValue,
	removeStored,
	writeJson,
	writeTabValue,
} from "#/lib/games/local-store";

type Area = "localStorage" | "sessionStorage";

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

function setStorage(area: Area, get: () => Storage) {
	Object.defineProperty(window, area, { configurable: true, get });
}

/** Private mode in some browsers: touching the storage object throws. */
function blockStorage(area: Area) {
	setStorage(area, () => {
		throw new DOMException("blocked", "SecurityError");
	});
}

describe("local-store with blocked storage", () => {
	beforeEach(() => {
		for (const area of ["localStorage", "sessionStorage"] as const) {
			const storage = memoryStorage();
			setStorage(area, () => storage);
		}
	});

	it("reads the fallback and ignores writes when localStorage is blocked", () => {
		blockStorage("localStorage");
		expect(() => writeJson("k", { a: 1 })).not.toThrow();
		expect(() => removeStored("k")).not.toThrow();
		expect(readJson("k", "fallback")).toBe("fallback");
	});

	it("reads null and ignores writes when sessionStorage is blocked", () => {
		blockStorage("sessionStorage");
		expect(() => writeTabValue("k", "v")).not.toThrow();
		expect(readTabValue("k")).toBeNull();
	});

	it("reads a corrupt value as the fallback", () => {
		window.localStorage.setItem("k", "{not json");
		expect(readJson("k", "fallback")).toBe("fallback");
	});
});

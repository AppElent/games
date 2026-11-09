// @vitest-environment jsdom
import { isUnguessableGuestId } from "@arcadeclub/core/sessions";
import { describe, expect, it } from "vitest";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";

/** A full localStorage: reads work, every write throws. */
function fullStorage(): Partial<Storage> {
	return {
		getItem: () => null,
		setItem: () => {
			throw new DOMException("full", "QuotaExceededError");
		},
	};
}

describe("getOrCreateGuestIdentity", () => {
	it("keeps one guest when storage will not save it", () => {
		const storage = fullStorage();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get: () => storage,
		});
		const first = getOrCreateGuestIdentity();
		expect(isUnguessableGuestId(first.id)).toBe(true);
		expect(getOrCreateGuestIdentity().id).toBe(first.id);
	});
});

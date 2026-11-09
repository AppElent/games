import { shouldCheckOnResume } from "./check-policy";

const HOUR = 60 * 60 * 1000;

describe("shouldCheckOnResume", () => {
	it("waits an hour between checks", () => {
		expect(shouldCheckOnResume(0, HOUR - 1)).toBe(false);
		expect(shouldCheckOnResume(0, HOUR)).toBe(true);
	});
});

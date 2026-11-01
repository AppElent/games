import { RESUME_CHECK_INTERVAL_MS, shouldCheckOnResume } from "./check-policy";

describe("shouldCheckOnResume", () => {
	it("checks when nothing was checked yet", () => {
		expect(shouldCheckOnResume(null, 0)).toBe(true);
	});

	it("waits an hour between checks", () => {
		expect(shouldCheckOnResume(0, RESUME_CHECK_INTERVAL_MS - 1)).toBe(false);
		expect(shouldCheckOnResume(0, RESUME_CHECK_INTERVAL_MS)).toBe(true);
	});
});

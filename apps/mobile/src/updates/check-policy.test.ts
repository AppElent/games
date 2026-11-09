import { RESUME_CHECK_INTERVAL_MS, shouldCheckOnResume } from "./check-policy";

describe("shouldCheckOnResume", () => {
	it("waits an hour between checks", () => {
		expect(shouldCheckOnResume(0, RESUME_CHECK_INTERVAL_MS - 1)).toBe(false);
		expect(shouldCheckOnResume(0, RESUME_CHECK_INTERVAL_MS)).toBe(true);
	});
});

import {
	forgetReturnTarget,
	returnAfterSignIn,
	takeReturnTarget,
} from "./return-target";

afterEach(() => {
	jest.useRealTimers();
	forgetReturnTarget();
});

describe("return target", () => {
	it("returns to the route once, for the same account", () => {
		returnAfterSignIn("/profile/delete-account", "user_1");
		expect(takeReturnTarget("user_1")).toBe("/profile/delete-account");
		expect(takeReturnTarget("user_1")).toBeNull();
	});

	it("is spent by another account without sending it anywhere", () => {
		returnAfterSignIn("/profile/delete-account", "user_1");
		expect(takeReturnTarget("user_2")).toBeNull();
		expect(takeReturnTarget("user_1")).toBeNull();
	});

	it("is dropped when the person closes the sign-in", () => {
		returnAfterSignIn("/profile/delete-account", "user_1");
		forgetReturnTarget();
		expect(takeReturnTarget("user_1")).toBeNull();
	});

	it("lapses, so a sign-in much later goes nowhere special", () => {
		jest.useFakeTimers();
		returnAfterSignIn("/profile/delete-account", "user_1");
		jest.advanceTimersByTime(11 * 60 * 1000);
		expect(takeReturnTarget("user_1")).toBeNull();
	});

	it("does not return when nothing was asked for", () => {
		expect(takeReturnTarget("user_1")).toBeNull();
	});
});

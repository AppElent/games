import {
	ImpactFeedbackStyle,
	impactAsync,
	NotificationFeedbackType,
	notificationAsync,
	selectionAsync,
} from "expo-haptics";
import { haptics } from "./haptics";

const calls = { impactAsync, selectionAsync, notificationAsync };

describe("haptics", () => {
	beforeEach(() => jest.clearAllMocks());

	it.each([
		["checkerLifted", "impactAsync", ImpactFeedbackStyle.Light],
		["targetEntered", "selectionAsync", undefined],
		["moveMade", "impactAsync", ImpactFeedbackStyle.Medium],
		["checkerHit", "impactAsync", ImpactFeedbackStyle.Heavy],
		["moveRejected", "notificationAsync", NotificationFeedbackType.Warning],
		["gameWon", "notificationAsync", NotificationFeedbackType.Success],
		["selectionChanged", "selectionAsync", undefined],
	] as const)("%s plays %s(%s), once", (name, call, style) => {
		haptics[name]();
		const played = jest.mocked(calls[call]);
		expect(played).toHaveBeenCalledTimes(1);
		if (style !== undefined) expect(played).toHaveBeenCalledWith(style);
		const others = Object.entries(calls)
			.filter(([other]) => other !== call)
			.map(([, fn]) => jest.mocked(fn).mock.calls.length);
		expect(others).toEqual([0, 0]);
	});
});

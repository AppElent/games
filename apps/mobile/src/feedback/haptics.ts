/**
 * Haptics named after what happened, not how it feels, so a screen says
 * `haptics.moveRejected()` and the mapping to a pattern lives here.
 * Every call is fire-and-forget: a device without a Taptic Engine is not an
 * error.
 */
import * as Haptics from "expo-haptics";

function run(effect: () => Promise<void>) {
	effect().catch(() => {});
}

export const haptics = {
	selectionChanged: () => run(() => Haptics.selectionAsync()),
	valueEntered: () =>
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
	moveMade: () =>
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
	moveRejected: () =>
		run(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
		),
	actionFailed: () =>
		run(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
		),
	gameWon: () =>
		run(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
		),
};

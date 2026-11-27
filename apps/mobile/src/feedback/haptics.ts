/**
 * Haptics named after what happened, not how it feels, so a screen says
 * `haptics.moveRejected()` and the mapping to a pattern lives here.
 * Every call is fire-and-forget: a device without a Taptic Engine is not an
 * error.
 */
import * as Haptics from "expo-haptics";
import { bestEffort } from "../observability/report";

function run(effect: () => Promise<void>) {
	bestEffort(effect());
}

export const haptics = {
	selectionChanged: () => run(() => Haptics.selectionAsync()),
	valueEntered: () =>
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
	/** A dragged checker leaves its stack. */
	checkerLifted: () =>
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
	/** A dragged checker enters a point it may land on; never on leaving one. */
	targetEntered: () => run(() => Haptics.selectionAsync()),
	moveMade: () =>
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
	/** A move that sends a blot to the bar, in place of `moveMade`. */
	checkerHit: () =>
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
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
	answerRevealed: () =>
		run(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
		),
};

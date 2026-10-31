/**
 * What one phone sees of a Hitster room: who it is in the game, whose turn
 * it is, and the cards on the relevant timeline. Pure, so the screen stays a
 * thin renderer and the rules for "my timeline" live in one place.
 */
import { getHitsterModeConfig, type HitsterMode } from "@games/core/hitster";
import { getHitsterCard, type HitsterCard } from "@games/core/hitster-packs";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/api";

export type HitsterBundle = NonNullable<
	FunctionReturnType<typeof api.hitster.getBundle>
>;
export type HitsterState = NonNullable<HitsterBundle["state"]>;

export function participantName(
	bundle: Pick<HitsterBundle, "participants">,
	participantId: string | undefined,
	fallback: string,
) {
	return (
		bundle.participants.find((entry) => entry._id === participantId)
			?.displayName ?? fallback
	);
}

/** The timeline a participant plays on: the shared one in co-op. */
export function timelineFor(
	state: Pick<HitsterState, "mode" | "timelines">,
	participantId: string | undefined,
) {
	return getHitsterModeConfig(state.mode as HitsterMode).shared
		? state.timelines[0]
		: state.timelines.find((entry) => entry.participantId === participantId);
}

export function timelineCards(
	state: Pick<HitsterState, "packId">,
	cardIds: readonly string[],
): HitsterCard[] {
	return cardIds.flatMap((cardId) => {
		const card = getHitsterCard(state.packId, cardId);
		return card ? [card] : [];
	});
}

export function roomView(bundle: HitsterBundle, participantId?: string) {
	const state = bundle.state;
	const isHost =
		participantId !== undefined &&
		bundle.session.hostParticipantId === participantId;
	if (!state) {
		return { isHost, state: null } as const;
	}
	const config = getHitsterModeConfig(state.mode as HitsterMode);
	const activeParticipantId = state.turnOrder[state.activeIndex];
	const isPlaying =
		participantId !== undefined &&
		state.turnOrder.some((entry) => entry === participantId);
	return {
		isHost,
		state,
		config,
		activeParticipantId,
		isActive: isPlaying && activeParticipantId === participantId,
		isPlaying,
		myTokens:
			state.tokens.find((entry) => entry.participantId === participantId)
				?.tokens ?? 0,
		hasClaimed: state.stealClaims.some(
			(claim) => claim.participantId === participantId,
		),
		myTimeline: timelineFor(state, participantId),
	} as const;
}

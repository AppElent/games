/**
 * What one phone sees of a Hitster room: who it is in the game, whose turn
 * it is, and the cards on the relevant timeline. Pure, so the screen stays a
 * thin renderer and the rules for "my timeline" live in one place.
 */
import {
	getHitsterModeConfig,
	type HitsterMode,
	hitsterTimelineFor,
} from "@arcadeclub/core/hitster";
import {
	getHitsterCard,
	type HitsterCard,
} from "@arcadeclub/core/hitster-packs";
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

/** Who counts as joined in the lobby: not watchers, not kicked players. */
export function lobbyPlayers(bundle: Pick<HitsterBundle, "participants">) {
	return bundle.participants.filter(
		(participant) => participant.role !== "watcher" && !participant.kickedAt,
	);
}

/** The timeline a participant plays on: the shared one in co-op. */
export function timelineFor(
	state: Pick<HitsterState, "mode" | "timelines">,
	participantId: string | undefined,
) {
	return hitsterTimelineFor(state, participantId);
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

/** The room once the host has picked a mode and the game has state. */
export type LiveRoomView = Extract<
	ReturnType<typeof roomView>,
	{ state: HitsterState }
>;

/**
 * Whether the player's own timeline shows below the round: never in the
 * lobby, and not while a placement or steal form already shows it.
 */
export function showsOwnTimeline(view: LiveRoomView, stealOpen: boolean) {
	const { state } = view;
	const placing =
		view.isActive && state.phase === "nowPlaying" && !state.pendingGuess;
	const stealing = stealOpen && !view.hasClaimed;
	return (
		state.phase !== "lobby" && Boolean(view.myTimeline) && !placing && !stealing
	);
}

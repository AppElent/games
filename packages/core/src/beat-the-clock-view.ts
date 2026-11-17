/**
 * What a Beat the Clock screen shows, worked out once for the web and the
 * app: which screen this viewer is on, their role in the turn, and the names
 * the copy needs. Both clients render from this and the room bundle.
 */
import {
	CLOCK_MIN_TEAM,
	CLOCK_NOTICE_MS,
	CLOCK_SCORE_DELAY_MS,
	type ClockRole,
	type ClockState,
	type ClockTurn,
	clockRole,
	nextDescriber,
	teamMembers,
	upcomingTurn,
} from "./beat-the-clock";

/** The room's state as `beatTheClock.getBundle` sends it: no deal order, no words. */
export type ClockPublicState = Omit<ClockState, "deck" | "used" | "turn"> & {
	turn?: Omit<ClockTurn, "words"> & { words?: undefined };
	deckLeft: number;
	packWillRunLow: boolean;
};

export type ClockParticipant = {
	_id: string;
	displayName: string;
	role: string;
	kickedAt?: number;
};

export type ClockScreen =
	| "lobby"
	| "late"
	| "turn"
	| "check"
	| "score"
	| "tie"
	| "finished";

/** The rules' view of the public state; the hidden parts are never read. */
function asRules(state: ClockPublicState): ClockState {
	return {
		...state,
		deck: [],
		used: [],
		turn: state.turn ? { ...state.turn, words: [] } : undefined,
	};
}

export function clockView(
	state: ClockPublicState,
	participants: readonly ClockParticipant[],
	viewerId: string | null,
	hostId: string | undefined,
	now: number,
) {
	const rules = asRules(state);
	const me = participants.find((p) => p._id === viewerId);
	const isWatcher = !me || me.role === "watcher";
	const role: ClockRole = clockRole(rules, me?._id, isWatcher);
	const myMember = state.members.find((m) => m.participantId === viewerId);
	const myPending = state.pending.find((p) => p.participantId === viewerId);
	const hasLeft = viewerId ? state.left.includes(viewerId) : false;
	const players = participants.filter(
		(p) => p.role !== "watcher" && !p.kickedAt && !state.left.includes(p._id),
	);
	const unassigned = players.filter(
		(p) =>
			!state.members.some((m) => m.participantId === p._id) &&
			!state.pending.some((w) => w.participantId === p._id),
	);
	const name = (id: string | undefined) =>
		participants.find((p) => p._id === id)?.displayName ?? "";
	const turn = state.turn;
	const playingTeam = turn?.team;
	const guesserIds =
		turn === undefined
			? []
			: teamMembers(rules, turn.team)
					.map((m) => m.participantId)
					.filter((id) => id !== turn.describerId);
	const otherTeams = Array.from(
		{ length: state.teamCount },
		(_, t) => t,
	).filter((t) => t !== playingTeam && teamMembers(rules, t).length > 0);
	const upcoming = state.phase === "score" ? upcomingTurn(rules) : undefined;

	const checkShowing =
		state.phase === "score" &&
		turn?.confirmedAt !== undefined &&
		!turn.skipped &&
		now - turn.confirmedAt < CLOCK_SCORE_DELAY_MS;

	let screen: ClockScreen;
	if (state.phase === "lobby") screen = "lobby";
	else if (state.phase === "finished") screen = "finished";
	else if (!isWatcher && (role === "waiting" || hasLeft)) screen = "late";
	else if (state.phase === "tie") screen = "tie";
	else if (state.phase === "checking" || checkShowing) screen = "check";
	else if (state.phase === "score") screen = "score";
	else screen = "turn";

	const noticeActive =
		state.notice !== undefined && now - state.notice.at < CLOCK_NOTICE_MS;

	return {
		screen,
		role,
		isWatcher,
		isHost: viewerId !== null && viewerId === hostId,
		me,
		myTeam: myMember?.team ?? myPending?.team,
		myPendingTeam: myMember?.pendingTeam ?? myPending?.team,
		hasLeft,
		players,
		unassigned,
		name,
		turn,
		playingTeam,
		describerName: name(turn?.describerId),
		guesserIds,
		otherTeams,
		upcoming,
		youreNext: upcoming !== undefined && upcoming.describerId === viewerId,
		noticeActive,
		/** Whether switching away would leave the viewer's team too small. */
		switchBlocked:
			myMember !== undefined &&
			state.phase !== "lobby" &&
			teamMembers(rules, myMember.team).length <= CLOCK_MIN_TEAM,
		teamMembers: (team: number) =>
			teamMembers(rules, team).map((m) => m.participantId),
		nextDescriberOf: (team: number) => nextDescriber(rules, team),
	};
}

export type ClockView = ReturnType<typeof clockView>;

/** Scores as "Rockets 21, Comets 18": highest first. */
export function scoreLine(
	scores: readonly number[],
	teamNames: readonly string[],
) {
	return scores
		.map((score, team) => ({ score, team }))
		.sort((a, b) => b.score - a.score || a.team - b.team)
		.map(({ score, team }) => `${teamNames[team]} ${score}`)
		.join(", ");
}

/** "0:17": the clock as the paused card shows it. */
export function clockTime(seconds: number) {
	const whole = Math.max(0, Math.ceil(seconds));
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

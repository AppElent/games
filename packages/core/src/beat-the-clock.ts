/**
 * Beat the Clock: teams take turns; one describer sees five words and
 * describes them against the clock while their team guesses out loud. The
 * other teams referee and can flag a word the describer said. One point per
 * word that counts; after a full round the highest team at or above the
 * target wins, and a tie at the top plays one more round.
 *
 * Pure and deterministic: every transition takes the time and, where it
 * deals, an `Rng`. The server owns the clock; it stores `deadline` and asks
 * `timeout` to move on when it passes.
 */
import { type GameErrorCode, GameRuleError } from "./errors";
import { type Rng, shuffle } from "./random";

export const CLOCK_PHASES = [
	"lobby",
	"ready",
	"describing",
	"timeUp",
	"checking",
	"score",
	"tie",
	"finished",
] as const;
export type ClockPhase = (typeof CLOCK_PHASES)[number];

export const CLOCK_TURN_SECONDS = [30, 45, 60] as const;
export const CLOCK_TARGETS = [20, 30, 50] as const;
export const CLOCK_TEAM_COUNTS = [2, 3, 4] as const;
export const CLOCK_END_REASONS = [
	"target",
	"host",
	"tooFewTeams",
	"ranOut",
] as const;
export type ClockEndReason = (typeof CLOCK_END_REASONS)[number];
export const CLOCK_ROUND_OUTCOMES = ["none", "win", "tie"] as const;
export type ClockRoundOutcome = (typeof CLOCK_ROUND_OUTCOMES)[number];
export const CLOCK_NOTICES = ["skipped", "skippedShort"] as const;
export type ClockNoticeKind = (typeof CLOCK_NOTICES)[number];

export const CLOCK_WORDS_PER_TURN = 5;
/** How long a describer has to send after time runs out. */
export const CLOCK_AUTO_SEND_MS = 10_000;
/** How long the referees have before the check confirms itself. */
export const CLOCK_CHECK_MS = 10_000;
/** How long a notice ("turn skipped") stays on screen. */
export const CLOCK_NOTICE_MS = 3_000;
/** How long phones keep showing a confirmed check before the score. */
export const CLOCK_SCORE_DELAY_MS = 2_000;
export const CLOCK_MIN_TEAM = 2;

export const CLOCK_DEFAULTS = {
	turnSeconds: 30,
	target: 30,
	teamCount: 2,
} as const;

/** A participant id; the rules never look inside it. */
type Pid = string;

export type ClockMember = {
	participantId: Pid;
	team: number;
	/** Join order within the room; describers rotate through it. */
	order: number;
	/** A switch asked for during a game; applies after the next turn is scored. */
	pendingTeam?: number;
};

export type ClockTurn = {
	team: number;
	describerId: Pid;
	/** Indices into the room's word pack. */
	words: number[];
	ticks: boolean[];
	/** Who flagged each word, or "" when nobody did. */
	flags: string[];
	skipped?: boolean;
	gain?: number;
	confirmedBy?: Pid;
	autoConfirmed?: boolean;
	confirmedAt?: number;
};

export type ClockSettings = {
	packId: string;
	locale: string;
	turnSeconds: number;
	target: number;
	teamCount: number;
};

export type ClockState = ClockSettings & {
	phase: ClockPhase;
	members: ClockMember[];
	/** Players who picked a team during a game and play from after the next turn. */
	pending: { participantId: Pid; team: number; order: number }[];
	nextOrder: number;
	/** Players who left the room; picking a team again brings them back. */
	left: Pid[];
	scores: number[];
	/** Turns each team has described; picks the next describer. */
	cursors: number[];
	round: number;
	/** Position in the round's team order: team `slot` plays next (or now). */
	slot: number;
	turnNumber: number;
	/** Word indices still to deal this game, in deal order. */
	deck: number[];
	/** Word indices used in this room, kept out of the next game. */
	used: number[];
	turn?: ClockTurn;
	roundOutcome: ClockRoundOutcome;
	/** When the running phase times out (describing, timeUp, checking). */
	deadline?: number;
	paused: boolean;
	/** Time left on the deadline while paused. */
	pausedRemaining?: number;
	notice?: { kind: ClockNoticeKind; team: number; at: number };
	endReason?: ClockEndReason;
	/** Winning team(s); several when the game ended tied. */
	winners: number[];
	/** Counted words per describer, for the end screen. */
	described: { participantId: Pid; words: number }[];
	/** Too few unused words for another game: the next one repeats words. */
	packWillRepeat: boolean;
};

function fail(code: GameErrorCode) {
	return new GameRuleError(code);
}

export function isClockSettingValid(settings: ClockSettings) {
	return (
		(CLOCK_TURN_SECONDS as readonly number[]).includes(settings.turnSeconds) &&
		(CLOCK_TARGETS as readonly number[]).includes(settings.target) &&
		(CLOCK_TEAM_COUNTS as readonly number[]).includes(settings.teamCount)
	);
}

export function createClockState(settings: ClockSettings): ClockState {
	if (!isClockSettingValid(settings)) {
		throw fail("clockBadSettings");
	}
	return {
		...settings,
		phase: "lobby",
		members: [],
		pending: [],
		nextOrder: 0,
		left: [],
		scores: Array(settings.teamCount).fill(0),
		cursors: Array(settings.teamCount).fill(0),
		round: 1,
		slot: 0,
		turnNumber: 0,
		deck: [],
		used: [],
		roundOutcome: "none",
		paused: false,
		winners: [],
		described: [],
		packWillRepeat: false,
	};
}

// ---------------------------------------------------------------- roster

/** Members of a team, describer rotation order. */
export function teamMembers(state: ClockState, team: number) {
	return state.members
		.filter((member) => member.team === team)
		.sort((a, b) => a.order - b.order);
}

export function teamOf(state: ClockState, participantId: Pid) {
	return state.members.find((m) => m.participantId === participantId)?.team;
}

function playableTeams(state: ClockState) {
	return range(state.teamCount).filter(
		(team) => teamMembers(state, team).length >= CLOCK_MIN_TEAM,
	);
}

/** Who would describe for this team on its next turn. */
export function nextDescriber(state: ClockState, team: number) {
	const members = teamMembers(state, team);
	if (members.length === 0) return undefined;
	return members[state.cursors[team] % members.length]?.participantId;
}

/** The team and describer up next from the score screen, skipping short teams. */
export function upcomingTurn(state: ClockState) {
	for (let step = state.slot; step < state.teamCount; step += 1) {
		if (teamMembers(state, step).length >= CLOCK_MIN_TEAM) {
			return { team: step, describerId: nextDescriber(state, step) as Pid };
		}
	}
	return undefined;
}

/**
 * Drops members who are no longer in the room (kicked, or left through the
 * server). `present` is every participant who may still play.
 */
export function syncRoster(state: ClockState, present: readonly Pid[]) {
	const keep = new Set(present);
	return {
		...state,
		members: state.members.filter((m) => keep.has(m.participantId)),
		pending: state.pending.filter((p) => keep.has(p.participantId)),
	};
}

/**
 * A player picks a team. In the lobby it applies at once; during a game it
 * applies after the next turn is scored, and may not leave a playing team
 * below two players.
 */
export function pickTeam(
	state: ClockState,
	participantId: Pid,
	team: number,
): ClockState {
	if (!Number.isInteger(team) || team < 0 || team >= state.teamCount) {
		throw fail("clockBadTeam");
	}
	if (state.phase === "finished") {
		throw fail("clockWrongPhase");
	}
	if (state.left.includes(participantId)) {
		return pickTeam(
			{ ...state, left: state.left.filter((id) => id !== participantId) },
			participantId,
			team,
		);
	}
	const member = state.members.find((m) => m.participantId === participantId);
	if (state.phase === "lobby") {
		const order = member?.order ?? state.nextOrder;
		return {
			...state,
			members: [
				...state.members.filter((m) => m.participantId !== participantId),
				{ participantId, team, order },
			],
			nextOrder: member ? state.nextOrder : state.nextOrder + 1,
		};
	}
	if (member) {
		if (member.team === team) {
			return {
				...state,
				members: state.members.map((m) =>
					m.participantId === participantId
						? { ...m, pendingTeam: undefined }
						: m,
				),
			};
		}
		if (state.turn?.describerId === participantId && isTurnLive(state)) {
			throw fail("clockSwitchBlocked");
		}
		if (staysOnTeam(state, member.team).length <= CLOCK_MIN_TEAM) {
			throw fail("clockSwitchBlocked");
		}
		return {
			...state,
			members: state.members.map((m) =>
				m.participantId === participantId ? { ...m, pendingTeam: team } : m,
			),
		};
	}
	const waiting = state.pending.find((p) => p.participantId === participantId);
	return {
		...state,
		pending: [
			...state.pending.filter((p) => p.participantId !== participantId),
			{ participantId, team, order: waiting?.order ?? state.nextOrder },
		],
		nextOrder: waiting ? state.nextOrder : state.nextOrder + 1,
	};
}

/** A team's members who stay after the switches already asked for. */
export function staysOnTeam(state: ClockState, team: number) {
	return teamMembers(state, team).filter(
		(m) => m.pendingTeam === undefined || m.pendingTeam === team,
	);
}

/** Host: spread everyone evenly over the teams at random. */
export function shuffleTeams(
	state: ClockState,
	players: readonly Pid[],
	rng: Rng,
): ClockState {
	if (state.phase !== "lobby") throw fail("clockWrongPhase");
	const ordered = players.map((participantId) => {
		const member = state.members.find((m) => m.participantId === participantId);
		return { participantId, order: member?.order };
	});
	let nextOrder = state.nextOrder;
	const shuffled = shuffle(ordered, rng);
	const members = shuffled.map((entry, index) => {
		const order = entry.order ?? nextOrder++;
		return {
			participantId: entry.participantId,
			team: index % state.teamCount,
			order,
		};
	});
	return { ...state, members, nextOrder };
}

/** Lobby players without a team join the smallest team (lowest number on a tie). */
function placeUnassigned(state: ClockState, players: readonly Pid[]) {
	let next = state;
	for (const participantId of players) {
		if (next.members.some((m) => m.participantId === participantId)) continue;
		const sizes = range(next.teamCount).map(
			(team) => teamMembers(next, team).length,
		);
		const smallest = sizes.indexOf(Math.min(...sizes));
		next = pickTeam(next, participantId, smallest);
	}
	return next;
}

/** Whether every team has enough players for Start (unassigned players fill the smallest teams). */
export function lobbyReady(state: ClockState, players: readonly Pid[]) {
	const placed = placeUnassigned(syncRoster(state, players), players);
	return range(placed.teamCount).every(
		(team) => teamMembers(placed, team).length >= CLOCK_MIN_TEAM,
	);
}

// ---------------------------------------------------------------- game flow

function isTurnLive(state: ClockState) {
	return (
		state.phase === "ready" ||
		state.phase === "describing" ||
		state.phase === "timeUp"
	);
}

/**
 * Host: start a game. `packSize` is the word pack's length; words used in
 * this room are dealt last-resort only when the pack would otherwise run dry.
 */
export function startGame(
	state: ClockState,
	players: readonly Pid[],
	packSize: number,
	rng: Rng,
	now: number,
): ClockState {
	if (state.phase !== "lobby") throw fail("clockWrongPhase");
	const placed = placeUnassigned(syncRoster(state, players), players);
	if (
		!range(placed.teamCount).every(
			(team) => teamMembers(placed, team).length >= CLOCK_MIN_TEAM,
		)
	) {
		throw fail("clockTeamsNeedTwo");
	}
	const used = state.packWillRepeat ? [] : state.used;
	const unused = range(packSize).filter((index) => !used.includes(index));
	return beginTurn(
		{
			...placed,
			deck: shuffle(unused, rng),
			used,
			scores: Array(placed.teamCount).fill(0),
			cursors: Array(placed.teamCount).fill(0),
			round: 1,
			slot: 0,
			turnNumber: 0,
			turn: undefined,
			roundOutcome: "none",
			paused: false,
			pausedRemaining: undefined,
			deadline: undefined,
			notice: undefined,
			endReason: undefined,
			winners: [],
			described: [],
			packWillRepeat: false,
		},
		now,
	);
}

/**
 * Deals the next turn: the team at `slot` (short teams are skipped with a
 * notice), its next describer, and five unused words. Ends the game when
 * fewer than two teams can play or the pack runs out.
 */
function beginTurn(state: ClockState, now: number): ClockState {
	if (playableTeams(state).length < 2) {
		return finish(state, "tooFewTeams");
	}
	let next = state;
	while (next.slot < next.teamCount) {
		if (teamMembers(next, next.slot).length >= CLOCK_MIN_TEAM) break;
		next = {
			...next,
			notice: { kind: "skippedShort", team: next.slot, at: now },
			slot: next.slot + 1,
		};
	}
	if (next.slot >= next.teamCount) {
		const evaluated = endOfRound(next);
		if (evaluated.roundOutcome !== "none") {
			return {
				...evaluated,
				phase: "score",
				turn: undefined,
				deadline: undefined,
				pausedRemaining: undefined,
			};
		}
		return beginTurn(evaluated, now);
	}
	if (next.deck.length < CLOCK_WORDS_PER_TURN) {
		return finish(next, "ranOut");
	}
	const team = next.slot;
	const words = next.deck.slice(0, CLOCK_WORDS_PER_TURN);
	return {
		...next,
		phase: "ready",
		turnNumber: next.turnNumber + 1,
		deck: next.deck.slice(CLOCK_WORDS_PER_TURN),
		used: [...next.used, ...words],
		turn: {
			team,
			describerId: nextDescriber(next, team) as Pid,
			words,
			ticks: words.map(() => false),
			flags: words.map(() => ""),
		},
		deadline: undefined,
		pausedRemaining: undefined,
		roundOutcome: "none",
	};
}

/** After the last slot: a team at or above the target wins; a tie plays on. */
function endOfRound(state: ClockState): ClockState {
	const top = Math.max(...state.scores);
	if (top >= state.target) {
		const leaders = leadingTeams(state);
		return { ...state, roundOutcome: leaders.length === 1 ? "win" : "tie" };
	}
	return { ...state, round: state.round + 1, slot: 0, roundOutcome: "none" };
}

export function leadingTeams(state: { scores: readonly number[] }) {
	const top = Math.max(...state.scores);
	return state.scores.flatMap((score, team) => (score === top ? [team] : []));
}

function finish(state: ClockState, reason: ClockEndReason): ClockState {
	return {
		...state,
		phase: "finished",
		endReason: reason,
		winners: leadingTeams(state),
		deadline: undefined,
		paused: false,
		pausedRemaining: undefined,
		packWillRepeat: false,
	};
}

function requirePhase(state: ClockState, ...phases: ClockPhase[]) {
	if (!phases.includes(state.phase)) throw fail("clockWrongPhase");
}

function requireRunning(state: ClockState) {
	if (state.paused) throw fail("clockPaused");
}

function requireDescriber(state: ClockState, participantId: Pid) {
	if (state.turn?.describerId !== participantId) {
		throw fail("clockNotDescriber");
	}
}

/** The describer taps Go: the words show and the clock runs. */
export function go(state: ClockState, participantId: Pid, now: number) {
	requirePhase(state, "ready");
	requireRunning(state);
	requireDescriber(state, participantId);
	return {
		...state,
		phase: "describing" as const,
		deadline: now + state.turnSeconds * 1000,
		notice: undefined,
	};
}

/** The describer ticks or unticks a word. After time's up a tick can only be undone. */
export function tick(
	state: ClockState,
	participantId: Pid,
	index: number,
	guessed: boolean,
): ClockState {
	requirePhase(state, "describing", "timeUp");
	requireDescriber(state, participantId);
	const turn = state.turn as ClockTurn;
	if (!Number.isInteger(index) || index < 0 || index >= turn.words.length) {
		throw fail("clockBadWord");
	}
	if (state.phase === "timeUp" && guessed && !turn.ticks[index]) {
		throw fail("clockTimeUp");
	}
	if (state.paused && state.phase === "describing") throw fail("clockPaused");
	return {
		...state,
		turn: {
			...turn,
			ticks: turn.ticks.map((value, i) => (i === index ? guessed : value)),
		},
	};
}

/** The describer sends the ticks (or ends the turn early); the check starts. */
export function send(state: ClockState, participantId: Pid, now: number) {
	requirePhase(state, "describing", "timeUp");
	requireDescriber(state, participantId);
	requireRunning(state);
	return startCheck(state, now);
}

function startCheck(state: ClockState, now: number): ClockState {
	// A check that starts while paused (the describer left) gets its full
	// time once the host resumes.
	return {
		...state,
		phase: "checking",
		deadline: now + CLOCK_CHECK_MS,
		pausedRemaining: state.paused ? CLOCK_CHECK_MS : undefined,
	};
}

/** A referee (any player of another team) flags or unflags a ticked word. */
export function flag(
	state: ClockState,
	participantId: Pid,
	index: number,
	flagged: boolean,
): ClockState {
	requirePhase(state, "checking");
	requireRunning(state);
	const turn = state.turn as ClockTurn;
	requireReferee(state, participantId);
	if (!Number.isInteger(index) || !turn.ticks[index]) {
		throw fail("clockBadWord");
	}
	return {
		...state,
		turn: {
			...turn,
			flags: turn.flags.map((value, i) =>
				i === index ? (flagged ? participantId : "") : value,
			),
		},
	};
}

function requireReferee(state: ClockState, participantId: Pid) {
	const team = teamOf(state, participantId);
	if (team === undefined || team === state.turn?.team) {
		throw fail("clockNotReferee");
	}
}

/** Words that count this turn: ticked and not flagged. */
export function turnGain(turn: ClockTurn) {
	return turn.ticks.filter((ticked, i) => ticked && !turn.flags[i]).length;
}

/** A referee confirms the check, or (`participantId` undefined) it confirms itself. */
export function confirm(
	state: ClockState,
	participantId: Pid | undefined,
	now: number,
): ClockState {
	requirePhase(state, "checking");
	requireRunning(state);
	if (participantId !== undefined) requireReferee(state, participantId);
	const turn = state.turn as ClockTurn;
	const gain = turnGain(turn);
	const described = state.described.some(
		(entry) => entry.participantId === turn.describerId,
	)
		? state.described.map((entry) =>
				entry.participantId === turn.describerId
					? { ...entry, words: entry.words + gain }
					: entry,
			)
		: [...state.described, { participantId: turn.describerId, words: gain }];
	return closeTurn(
		{
			...state,
			scores: state.scores.map((score, team) =>
				team === turn.team ? score + gain : score,
			),
			described,
			turn: {
				...turn,
				gain,
				confirmedBy: participantId,
				autoConfirmed: participantId === undefined,
				confirmedAt: now,
			},
		},
		turn.team,
	);
}

/** The played team's turn is done: rotate its describer, apply switches, move the slot. */
function closeTurn(state: ClockState, team: number): ClockState {
	const cursors = state.cursors.map((cursor, t) =>
		t === team ? cursor + 1 : cursor,
	);
	const members = state.members.map(({ pendingTeam, ...member }) =>
		pendingTeam === undefined ? member : { ...member, team: pendingTeam },
	);
	const joined = state.pending.map(({ participantId, team, order }) => ({
		participantId,
		team,
		order,
	}));
	const next: ClockState = {
		...state,
		cursors,
		members: [...members, ...joined],
		pending: [],
		slot: team + 1,
		phase: "score",
		deadline: undefined,
		pausedRemaining: undefined,
		notice: undefined,
	};
	if (next.slot >= next.teamCount) return endOfRound(next);
	return { ...next, roundOutcome: "none" };
}

/** The server's clock: the running phase's deadline passed. */
export function timeout(state: ClockState, now: number): ClockState {
	if (state.paused || state.deadline === undefined || now < state.deadline) {
		return state;
	}
	if (state.phase === "describing") {
		return { ...state, phase: "timeUp", deadline: now + CLOCK_AUTO_SEND_MS };
	}
	if (state.phase === "timeUp") return startCheck(state, now);
	if (state.phase === "checking") return confirm(state, undefined, now);
	return state;
}

/** The next describer taps Next on the score screen: their ready screen. */
export function nextTurn(state: ClockState, participantId: Pid, now: number) {
	requirePhase(state, "score");
	requireRunning(state);
	if (state.roundOutcome !== "none") throw fail("clockWrongPhase");
	const upcoming = upcomingTurn(state);
	if (upcoming && upcoming.describerId !== participantId) {
		throw fail("clockNotNextDescriber");
	}
	return beginTurn(state, now);
}

/** Anyone: after a round that hit the target, show the winner (or the tie). */
export function seeWinner(state: ClockState): ClockState {
	requirePhase(state, "score");
	if (state.roundOutcome === "win") return finish(state, "target");
	if (state.roundOutcome === "tie") return { ...state, phase: "tie" };
	throw fail("clockWrongPhase");
}

/** Anyone: start the extra round after a tie at the top. */
export function startExtraRound(state: ClockState, now: number) {
	requirePhase(state, "tie");
	return beginTurn(
		{ ...state, round: state.round + 1, slot: 0, roundOutcome: "none" },
		now,
	);
}

/**
 * Host: skip a turn. From ready, describing or time's up the playing team
 * scores 0; from the score screen the upcoming turn is skipped.
 */
export function skipTurn(state: ClockState, now: number): ClockState {
	let closed: ClockState;
	if (isTurnLive(state)) {
		const turn = state.turn as ClockTurn;
		closed = closeTurn(
			{ ...state, turn: { ...turn, skipped: true, gain: 0 } },
			turn.team,
		);
	} else if (state.phase === "score" && state.roundOutcome === "none") {
		const upcoming = upcomingTurn(state);
		if (!upcoming) return beginTurn(state, now);
		closed = closeTurn(
			{
				...state,
				turn: {
					team: upcoming.team,
					describerId: upcoming.describerId,
					words: [],
					ticks: [],
					flags: [],
					skipped: true,
					gain: 0,
				},
			},
			upcoming.team,
		);
	} else {
		throw fail("clockWrongPhase");
	}
	if (closed.roundOutcome !== "none") return closed;
	const skippedTeam = (closed.turn as ClockTurn).team;
	const next = beginTurn(closed, now);
	return next.phase === "ready" && next.notice?.kind !== "skippedShort"
		? { ...next, notice: { kind: "skipped", team: skippedTeam, at: now } }
		: next;
}

/** Host: freeze the running phase for everyone. */
export function pause(state: ClockState, now: number): ClockState {
	if (state.phase === "lobby" || state.phase === "finished") {
		throw fail("clockWrongPhase");
	}
	if (state.paused) return state;
	return {
		...state,
		paused: true,
		pausedRemaining:
			state.deadline === undefined
				? undefined
				: Math.max(0, state.deadline - now),
	};
}

/** Host: let the frozen phase run on from where it stopped. */
export function resume(state: ClockState, now: number): ClockState {
	if (!state.paused) return state;
	return {
		...state,
		paused: false,
		deadline:
			state.pausedRemaining === undefined
				? undefined
				: now + state.pausedRemaining,
		pausedRemaining: undefined,
	};
}

/** Host: end the game now. The current turn doesn't count. */
export function endGame(state: ClockState): ClockState {
	if (state.phase === "lobby" || state.phase === "finished") {
		throw fail("clockWrongPhase");
	}
	return finish(state, "host");
}

/**
 * A player leaves. A describer who leaves mid-turn sends their ticks as they
 * stand; one who leaves on the ready screen hands the turn to the next
 * teammate, or the team is skipped when it drops below two.
 */
export function leave(
	state: ClockState,
	participantId: Pid,
	now: number,
): ClockState {
	const wasDescriber = state.turn?.describerId === participantId;
	const without: ClockState = {
		...state,
		left: state.left.includes(participantId)
			? state.left
			: [...state.left, participantId],
		members: state.members.filter((m) => m.participantId !== participantId),
		pending: state.pending.filter((p) => p.participantId !== participantId),
	};
	if (state.phase === "lobby" || state.phase === "finished" || !wasDescriber) {
		return without;
	}
	const turn = state.turn as ClockTurn;
	if (state.phase === "describing" || state.phase === "timeUp") {
		return startCheck(without, now);
	}
	if (state.phase === "ready") {
		if (teamMembers(without, turn.team).length >= CLOCK_MIN_TEAM) {
			return {
				...without,
				turn: {
					...turn,
					describerId: nextDescriber(without, turn.team) as Pid,
				},
			};
		}
		// Put the dealt words back on top: nobody saw them.
		return beginTurn(
			{
				...without,
				deck: [...turn.words, ...without.deck],
				used: without.used.filter((word) => !turn.words.includes(word)),
				turnNumber: without.turnNumber - 1,
				notice: { kind: "skippedShort", team: turn.team, at: now },
				slot: turn.team + 1,
			},
			now,
		);
	}
	return without;
}

/**
 * Host, after a game: play again with the same teams (back to the lobby when
 * a team is short), or with `newTeams` clear the teams and return to the lobby.
 */
export function rematch(
	state: ClockState,
	players: readonly Pid[],
	packSize: number,
	rng: Rng,
	now: number,
	newTeams: boolean,
): ClockState {
	requirePhase(state, "finished");
	const unusedLeft = packSize - state.used.length;
	const lobby: ClockState = {
		...syncRoster(state, players),
		phase: "lobby",
		turn: undefined,
		packWillRepeat: unusedLeft < CLOCK_WORDS_PER_TURN * 2,
		endReason: undefined,
		winners: [],
	};
	if (newTeams) return { ...lobby, members: [], pending: [] };
	const merged = {
		...lobby,
		members: [
			...lobby.members.map(({ pendingTeam, ...member }) =>
				pendingTeam === undefined ? member : { ...member, team: pendingTeam },
			),
			...lobby.pending,
		],
		pending: [],
	};
	const ready = range(merged.teamCount).every(
		(team) => teamMembers(merged, team).length >= CLOCK_MIN_TEAM,
	);
	return ready ? startGame(merged, players, packSize, rng, now) : merged;
}

/** Whether few enough unused words remain that the next game repeats some. */
export function packRunsLow(state: ClockState, packSize: number) {
	return packSize - state.used.length < CLOCK_WORDS_PER_TURN * 2;
}

/** The describer whose turns produced the most counted words; none on a tie. */
export function bestDescriber(state: ClockState) {
	const sorted = [...state.described].sort((a, b) => b.words - a.words);
	const [first, second] = sorted;
	if (!first || first.words === 0) return undefined;
	if (second && second.words === first.words) return undefined;
	return first.participantId;
}

// ---------------------------------------------------------------- viewing

export type ClockRole =
	| "describer"
	| "teammate"
	| "opponent"
	| "watcher"
	| "waiting";

/**
 * How one viewer takes part in the running turn. `waiting`: a player not on
 * a team yet (late joiner) or whose team change has yet to apply.
 */
export function clockRole(
	state: ClockState,
	participantId: Pid | undefined,
	isWatcher: boolean,
): ClockRole {
	if (isWatcher || participantId === undefined) return "watcher";
	const team = teamOf(state, participantId);
	if (team === undefined) return "waiting";
	if (!state.turn) return "opponent";
	if (state.turn.describerId === participantId) return "describer";
	return team === state.turn.team ? "teammate" : "opponent";
}

/** Whether this role may see the turn's words now. */
export function canSeeWords(state: ClockState, role: ClockRole) {
	if (!state.turn || state.phase === "ready") return false;
	if (state.phase === "describing" || state.phase === "timeUp") {
		if (state.paused) return false;
		return role === "describer" || role === "opponent";
	}
	return true;
}

/** Seconds left on the running phase, from the server's deadline. */
export function secondsLeft(
	state: Pick<
		ClockState,
		"paused" | "pausedRemaining" | "deadline" | "phase" | "turnSeconds"
	>,
	now: number,
) {
	if (state.paused) {
		return Math.ceil((state.pausedRemaining ?? 0) / 1000);
	}
	if (state.deadline === undefined) {
		return state.phase === "ready" ? state.turnSeconds : 0;
	}
	return Math.max(0, Math.ceil((state.deadline - now) / 1000));
}

/** Teams by score, highest first; ties keep team order. */
export function rankedTeams(state: { scores: readonly number[] }) {
	return state.scores
		.map((score, team) => ({ team, score }))
		.sort((a, b) => b.score - a.score || a.team - b.team);
}

function range(count: number) {
	return Array.from({ length: count }, (_, index) => index);
}

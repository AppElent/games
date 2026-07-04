import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import {
	BackgammonBoard,
	type BackgammonBoardOptions,
	type BackgammonOptionKey,
} from "#/components/backgammon/BackgammonBoard";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import {
	applyBackgammonPlan,
	type BackgammonColor,
	type BackgammonMoveDestination,
	type BackgammonMovePlan,
	type BackgammonMoveSource,
	type BackgammonPoint,
	type BackgammonTurnState,
	computeUsedFlags,
} from "#/lib/games/backgammon";
import { getUserErrorMessage } from "#/lib/games/errors";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackgammonMoveLog } from "./BackgammonMoveLog";

type Participant = {
	_id: Id<"sessionParticipants">;
	displayName: string;
	role: "host" | "player" | "watcher";
	seat?: string;
	connected: boolean;
};

type Bundle = {
	session: {
		_id: Id<"gameSessions">;
		title: string;
		shareToken?: string;
	};
	participants: Participant[];
	state: {
		phase: "waiting" | "ready" | "active" | "finished";
		whiteParticipantId?: Id<"sessionParticipants">;
		blackParticipantId?: Id<"sessionParticipants">;
		winnerParticipantId?: Id<"sessionParticipants">;
		activeColor: BackgammonColor;
		points: BackgammonPoint[];
		bar: { white: number; black: number };
		off: { white: number; black: number };
		dice: number[];
		usedDice: number[];
	} | null;
	moves: Array<{
		_id: string;
		moveType: "roll" | "move" | "endTurn";
		color: BackgammonColor;
		from?: BackgammonMoveSource;
		to?: BackgammonMoveDestination;
		dice: number[];
		createdAt: number;
	}>;
};

export function BackgammonWaitingRoom({
	bundle,
	shareUrl,
}: {
	bundle: Bundle;
	shareUrl: string;
}) {
	const rollDice = useMutation(api.backgammon.rollDice);
	const applyMove = useMutation(api.backgammon.applyMove);
	const endTurn = useMutation(api.backgammon.endTurn);
	const [participantId, setParticipantId] = useState<string>();
	const [error, setError] = useState("");
	const [options, setOptions] = useState<BackgammonBoardOptions>({
		showNumbers: true,
		autoRoll: false,
		autoSwitchTurn: true,
		autoCombine: true,
	});

	useEffect(() => {
		setParticipantId(
			window.sessionStorage.getItem("arcade-club.participantId") ?? undefined,
		);
	}, []);

	const white = bundle.participants.find(
		(participant) => participant._id === bundle.state?.whiteParticipantId,
	);
	const black = bundle.participants.find(
		(participant) => participant._id === bundle.state?.blackParticipantId,
	);
	const winner = bundle.participants.find(
		(participant) => participant._id === bundle.state?.winnerParticipantId,
	);
	const localColor: BackgammonColor | undefined =
		bundle.state?.whiteParticipantId === participantId
			? "white"
			: bundle.state?.blackParticipantId === participantId
				? "black"
				: undefined;
	const opponentJoined = Boolean(bundle.state?.blackParticipantId);
	const finished = bundle.state?.phase === "finished";
	const myTurn =
		Boolean(participantId) &&
		Boolean(localColor) &&
		bundle.state?.activeColor === localColor &&
		opponentJoined &&
		!finished;

	const turnState: BackgammonTurnState | null = bundle.state
		? {
				points: bundle.state.points,
				bar: bundle.state.bar,
				off: bundle.state.off,
				activeColor: bundle.state.activeColor,
				dice: bundle.state.dice,
				used: computeUsedFlags(bundle.state.dice, bundle.state.usedDice),
			}
		: null;

	async function handleRoll() {
		if (!participantId) {
			setError("Join this challenge before rolling");
			return;
		}
		setError("");
		try {
			await rollDice({
				sessionId: bundle.session._id,
				participantId: participantId as Id<"sessionParticipants">,
			});
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not roll dice"));
		}
	}

	async function handlePlan(plan: BackgammonMovePlan) {
		if (!participantId || !turnState) {
			return;
		}
		setError("");
		try {
			for (const step of plan.steps) {
				await applyMove({
					sessionId: bundle.session._id,
					participantId: participantId as Id<"sessionParticipants">,
					from: step.from,
					to: step.to,
				});
			}
			// End the turn automatically once every die is spent.
			const after = applyBackgammonPlan(turnState, plan);
			if (options.autoSwitchTurn && after.used.every(Boolean)) {
				await endTurn({
					sessionId: bundle.session._id,
					participantId: participantId as Id<"sessionParticipants">,
				});
			}
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not move"));
		}
	}

	async function handleEndTurn() {
		if (!participantId) {
			setError("Join this challenge before ending a turn");
			return;
		}
		setError("");
		try {
			await endTurn({
				sessionId: bundle.session._id,
				participantId: participantId as Id<"sessionParticipants">,
			});
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not end turn"));
		}
	}

	function handleToggleOption(key: BackgammonOptionKey) {
		setOptions((current) => ({ ...current, [key]: !current[key] }));
	}

	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
			<section className="space-y-4">
				<div className="club-panel rounded-lg p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="club-kicker mb-2">Backgammon</p>
							<h1 className="club-title text-3xl font-bold text-white">
								{bundle.session.title}
							</h1>
						</div>
						<span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-300">
							{bundle.state?.phase ?? "loading"}
						</span>
					</div>
					<div className="mt-4">
						<SeatBanner
							tone={
								finished ? "success" : opponentJoined ? "success" : "warning"
							}
							label={
								finished
									? `${winner?.displayName ?? "Someone"} wins the match!`
									: opponentJoined
										? localColor
											? `You are playing ${localColor}.`
											: "Both seats are claimed — you are watching."
										: "Share the link with one opponent to claim the black seat."
							}
						/>
					</div>
					<div className="mt-4 grid gap-3 md:grid-cols-2">
						<SeatCard
							label="White"
							name={white?.displayName ?? "Host"}
							counts={
								bundle.state
									? `Bar ${bundle.state.bar.white} / Off ${bundle.state.off.white}`
									: undefined
							}
							active={!finished && bundle.state?.activeColor === "white"}
						/>
						<SeatCard
							label="Black"
							name={black?.displayName ?? "Open seat"}
							counts={
								bundle.state
									? `Bar ${bundle.state.bar.black} / Off ${bundle.state.off.black}`
									: undefined
							}
							active={!finished && bundle.state?.activeColor === "black"}
							open={!black}
						/>
					</div>
					{error ? (
						<p className="mt-3 text-sm text-orange-200">{error}</p>
					) : null}
				</div>

				{turnState ? (
					<div className="flex justify-center">
						<BackgammonBoard
							state={turnState}
							interactive={myTurn}
							canRoll={myTurn && turnState.dice.length === 0}
							canEndTurn={myTurn && turnState.dice.length > 0}
							options={options}
							optionKeys={["showNumbers", "autoSwitchTurn", "autoCombine"]}
							onToggleOption={handleToggleOption}
							onPlan={handlePlan}
							onRoll={handleRoll}
							onEndTurn={handleEndTurn}
							statusOverride={
								finished
									? `${winner?.displayName ?? "Winner"} has borne off all 15 checkers`
									: !opponentJoined
										? "Waiting for an opponent to join"
										: myTurn
											? undefined
											: `Waiting for ${bundle.state?.activeColor === "white" ? (white?.displayName ?? "white") : (black?.displayName ?? "black")} to play`
							}
						/>
					</div>
				) : (
					<div className="club-panel rounded-lg p-6 text-center">
						<p className="club-kicker mb-2">Setting up</p>
						<h2 className="club-title text-2xl font-bold text-white">
							Board is loading
						</h2>
					</div>
				)}
			</section>
			<aside className="space-y-4">
				<QrSharePanel label="Challenge link" url={shareUrl} />
				<ParticipantList participants={bundle.participants} />
				<BackgammonMoveLog moves={bundle.moves} />
			</aside>
		</div>
	);
}

function SeatCard({
	label,
	name,
	counts,
	active = false,
	open = false,
}: {
	label: string;
	name: string;
	counts?: string;
	active?: boolean;
	open?: boolean;
}) {
	return (
		<div
			className={`rounded-lg border p-4 ${
				open
					? "border-dashed border-orange-300/40 bg-orange-300/10"
					: active
						? "border-cyan-300/40 bg-cyan-300/10"
						: "border-white/10 bg-white/5"
			}`}
		>
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs font-bold uppercase tracking-wide text-slate-400">
					{label}
				</p>
				{active ? (
					<span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
						Turn
					</span>
				) : null}
			</div>
			<p className="mt-1 truncate text-lg font-bold text-white">{name}</p>
			{counts ? <p className="mt-2 text-xs text-slate-400">{counts}</p> : null}
		</div>
	);
}

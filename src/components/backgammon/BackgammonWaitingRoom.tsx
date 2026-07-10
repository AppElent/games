import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import {
	BackgammonBoard,
	type BackgammonBoardOptions,
	type BackgammonOptionKey,
} from "#/components/backgammon/BackgammonBoard";
import { FitScale, RotateHint } from "#/components/games/FitScale";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { GameEndScreen } from "#/components/games/GameEndScreen";
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
import { fmt, useMessages } from "#/lib/i18n";
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
	const messages = useMessages();
	const backgammon = messages.games.backgammon;
	const rollDice = useMutation(api.backgammon.rollDice);
	const applyMove = useMutation(api.backgammon.applyMove);
	const endTurn = useMutation(api.backgammon.endTurn);
	const rematch = useMutation(api.backgammon.rematch);
	const [participantId, setParticipantId] = useState<string>();
	const [error, setError] = useState("");
	const [showInfo, setShowInfo] = useState(false);
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
			setError(backgammon.waitingRoom.joinBeforeRolling);
			return;
		}
		setError("");
		try {
			await rollDice({
				sessionId: bundle.session._id,
				participantId: participantId as Id<"sessionParticipants">,
			});
		} catch (caught) {
			setError(getUserErrorMessage(caught, backgammon.waitingRoom.rollError));
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
			setError(getUserErrorMessage(caught, backgammon.waitingRoom.moveError));
		}
	}

	async function handleEndTurn() {
		if (!participantId) {
			setError(backgammon.waitingRoom.joinBeforeEndingTurn);
			return;
		}
		setError("");
		try {
			await endTurn({
				sessionId: bundle.session._id,
				participantId: participantId as Id<"sessionParticipants">,
			});
		} catch (caught) {
			setError(
				getUserErrorMessage(caught, backgammon.waitingRoom.endTurnError),
			);
		}
	}

	function handleToggleOption(key: BackgammonOptionKey) {
		setOptions((current) => ({ ...current, [key]: !current[key] }));
	}

	const seatCards = (
		<div className="grid gap-3 md:grid-cols-2">
			<SeatCard
				label={backgammon.waitingRoom.seatWhite}
				turnLabel={backgammon.waitingRoom.turnBadge}
				name={white?.displayName ?? messages.common.session.host}
				counts={
					bundle.state
						? fmt(backgammon.waitingRoom.seatCounts, {
								bar: bundle.state.bar.white,
								off: bundle.state.off.white,
							})
						: undefined
				}
				active={!finished && bundle.state?.activeColor === "white"}
			/>
			<SeatCard
				label={backgammon.waitingRoom.seatBlack}
				turnLabel={backgammon.waitingRoom.turnBadge}
				name={black?.displayName ?? backgammon.waitingRoom.openSeat}
				counts={
					bundle.state
						? fmt(backgammon.waitingRoom.seatCounts, {
								bar: bundle.state.bar.black,
								off: bundle.state.off.black,
							})
						: undefined
				}
				active={!finished && bundle.state?.activeColor === "black"}
				open={!black}
			/>
		</div>
	);

	// Pre-game: opponent hasn't claimed the black seat yet — show a scrollable
	// share screen instead of the board.
	if (!turnState || !opponentJoined) {
		return (
			<FullscreenGamePage
				title={bundle.session.title}
				maxWidthClassName="max-w-md"
			>
				<p className="club-kicker mb-2">{messages.catalog.backgammon.title}</p>
				<h1 className="club-title mb-4 text-3xl font-bold text-white">
					{bundle.session.title}
				</h1>
				<div className="space-y-4">
					<SeatBanner
						tone="warning"
						label={backgammon.waitingRoom.shareToClaimBlackSeat}
					/>
					{seatCards}
					{error ? <p className="text-sm text-orange-200">{error}</p> : null}
					<QrSharePanel
						label={backgammon.waitingRoom.challengeLinkLabel}
						url={shareUrl}
					/>
					<ParticipantList participants={bundle.participants} />
				</div>
			</FullscreenGamePage>
		);
	}

	return (
		<FullscreenGameShell
			title={bundle.session.title}
			hud={
				<div className="flex items-center justify-end gap-2">
					{error ? (
						<span className="max-w-[50vw] truncate rounded-xl bg-orange-950/70 px-3 py-2 text-xs text-orange-200 backdrop-blur">
							{error}
						</span>
					) : null}
					<button
						type="button"
						onClick={() => setShowInfo((open) => !open)}
						className="flex h-11 items-center rounded-xl border border-white/20 bg-slate-900/70 px-4 text-sm font-bold text-white backdrop-blur"
					>
						{backgammon.waitingRoom.infoButton}
					</button>
				</div>
			}
		>
			<div className="flex h-full flex-col">
				<div className="min-h-0 flex-1 px-2 pt-14 pb-1 landscape:pt-1 landscape:pl-14">
					<FitScale designWidth={1060}>
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
									? fmt(backgammon.waitingRoom.finishedStatus, {
											name:
												winner?.displayName ??
												backgammon.waitingRoom.winnerFallback,
										})
									: myTurn
										? undefined
										: fmt(backgammon.waitingRoom.waitingForPlayerToPlay, {
												name:
													bundle.state?.activeColor === "white"
														? (white?.displayName ??
															backgammon.board.colorWhite)
														: (black?.displayName ??
															backgammon.board.colorBlack),
											})
							}
						/>
					</FitScale>
				</div>
				<RotateHint />
			</div>
			{finished && !showInfo ? (
				<div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm">
					<div className="h-full touch-pan-y overflow-y-auto overscroll-contain p-4 pt-16">
						<div className="mx-auto max-w-md">
							<GameEndScreen
								heading={fmt(backgammon.waitingRoom.winsTheMatch, {
									name:
										winner?.displayName ??
										backgammon.waitingRoom.someoneFallback,
								})}
								subtitle={
									localColor
										? winner &&
											bundle.state?.winnerParticipantId === participantId
											? backgammon.waitingRoom.subtitleWon
											: backgammon.waitingRoom.subtitleLost
										: undefined
								}
								shareText={fmt(backgammon.waitingRoom.shareText, {
									name:
										winner?.displayName ??
										backgammon.waitingRoom.someoneFallbackLower,
								})}
								onRematch={
									localColor
										? () => {
												void rematch({
													sessionId: bundle.session._id,
													participantId:
														participantId as Id<"sessionParticipants">,
												}).catch((caught) =>
													setError(
														getUserErrorMessage(
															caught,
															backgammon.waitingRoom.rematchError,
														),
													),
												);
											}
										: undefined
								}
								rematchLabel={backgammon.waitingRoom.rematchLabel}
								newGameRoute="/backgammon/new"
							/>
						</div>
					</div>
				</div>
			) : null}
			{showInfo ? (
				<div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm">
					<div className="h-full touch-pan-y overflow-y-auto overscroll-contain p-4 pt-16">
						<div className="mx-auto max-w-md space-y-4">
							<SeatBanner
								tone="success"
								label={
									finished
										? fmt(backgammon.waitingRoom.winsTheMatch, {
												name:
													winner?.displayName ??
													backgammon.waitingRoom.someoneFallback,
											})
										: localColor
											? fmt(backgammon.waitingRoom.youArePlaying, {
													color:
														localColor === "white"
															? backgammon.board.colorWhite
															: backgammon.board.colorBlack,
												})
											: backgammon.waitingRoom.bothSeatsClaimed
								}
							/>
							{seatCards}
							<QrSharePanel
								label={backgammon.waitingRoom.challengeLinkLabel}
								url={shareUrl}
							/>
							<ParticipantList participants={bundle.participants} />
							<BackgammonMoveLog moves={bundle.moves} />
							<button
								type="button"
								onClick={() => setShowInfo(false)}
								className="w-full min-h-11 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
							>
								{messages.common.actions.close}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</FullscreenGameShell>
	);
}

function SeatCard({
	label,
	turnLabel,
	name,
	counts,
	active = false,
	open = false,
}: {
	label: string;
	turnLabel: string;
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
						{turnLabel}
					</span>
				) : null}
			</div>
			<p className="mt-1 truncate text-lg font-bold text-white">{name}</p>
			{counts ? <p className="mt-2 text-xs text-slate-400">{counts}</p> : null}
		</div>
	);
}

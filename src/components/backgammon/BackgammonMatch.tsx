import {
	applyBackgammonPlan,
	type BackgammonColor,
	type BackgammonMovePlan,
	type BackgammonTurnState,
	canEndBackgammonTurn,
	computeUsedFlags,
	isTurnSpent,
} from "@arcadeclub/core/backgammon";
import { DEFAULT_ONLINE_OPTIONS } from "@arcadeclub/core/backgammon-local";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import {
	BACKGAMMON_DESIGN_WIDTH,
	BackgammonBoard,
	type BackgammonBoardOptions,
	type BackgammonOptionKey,
	ONLINE_OPTION_KEYS,
} from "#/components/backgammon/BackgammonBoard";
import { RotateHint } from "#/components/games/FitScale";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import {
	GameInfoOverlay,
	MatchOverlay,
} from "#/components/games/match/GameInfoOverlay";
import { MatchHud, MatchStage } from "#/components/games/match/MatchStage";
import { MatchWaitingScreen } from "#/components/games/match/MatchWaitingScreen";
import {
	SeatCard,
	SeatCards,
	SeatName,
} from "#/components/games/match/SeatCard";
import { getGameRoute } from "#/lib/games/catalog";
import { useSeat } from "#/lib/games/seat";
import { useGameAction } from "#/lib/games/use-game-action";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { BackgammonMoveLog } from "./BackgammonMoveLog";
import { colorLabel } from "./color-label";

type Bundle = NonNullable<FunctionReturnType<typeof api.backgammon.getBundle>>;

export function BackgammonMatch({
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
	const participantId = useSeat(bundle.session._id);
	const { error, setError, run } = useGameAction();
	const [showInfo, setShowInfo] = useState(false);
	const [options, setOptions] = useState<BackgammonBoardOptions>(
		DEFAULT_ONLINE_OPTIONS,
	);

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

	function handleRoll() {
		if (!participantId) {
			setError(backgammon.waitingRoom.joinBeforeRolling);
			return;
		}
		run(
			() => rollDice({ sessionId: bundle.session._id, participantId }),
			backgammon.waitingRoom.rollError,
		);
	}

	function handlePlan(plan: BackgammonMovePlan) {
		if (!participantId || !turnState) {
			return;
		}
		run(async () => {
			for (const step of plan.steps) {
				await applyMove({
					sessionId: bundle.session._id,
					participantId,
					from: step.from,
					to: step.to,
				});
			}
			// End the turn automatically once every die is spent.
			const after = applyBackgammonPlan(turnState, plan);
			if (options.autoSwitchTurn && isTurnSpent(after)) {
				await endTurn({ sessionId: bundle.session._id, participantId });
			}
		}, backgammon.waitingRoom.moveError);
	}

	function handleEndTurn() {
		if (!participantId) {
			setError(backgammon.waitingRoom.joinBeforeEndingTurn);
			return;
		}
		run(
			() => endTurn({ sessionId: bundle.session._id, participantId }),
			backgammon.waitingRoom.endTurnError,
		);
	}

	function handleToggleOption(key: BackgammonOptionKey) {
		setOptions((current) => ({ ...current, [key]: !current[key] }));
	}

	const seatCards = (
		<SeatCards>
			<SeatCard
				label={backgammon.waitingRoom.seatWhite}
				turnLabel={backgammon.waitingRoom.turnBadge}
				active={!finished && bundle.state?.activeColor === "white"}
			>
				<SeatName name={white?.displayName ?? messages.common.session.host} />
				<SeatCounts
					counts={
						bundle.state
							? fmt(backgammon.waitingRoom.seatCounts, {
									bar: bundle.state.bar.white,
									off: bundle.state.off.white,
								})
							: undefined
					}
				/>
			</SeatCard>
			<SeatCard
				label={backgammon.waitingRoom.seatBlack}
				turnLabel={backgammon.waitingRoom.turnBadge}
				active={!finished && bundle.state?.activeColor === "black"}
				open={!black}
			>
				<SeatName
					name={black?.displayName ?? backgammon.waitingRoom.openSeat}
				/>
				<SeatCounts
					counts={
						bundle.state
							? fmt(backgammon.waitingRoom.seatCounts, {
									bar: bundle.state.bar.black,
									off: bundle.state.off.black,
								})
							: undefined
					}
				/>
			</SeatCard>
		</SeatCards>
	);

	// Pre-game: opponent hasn't claimed the black seat yet — show a scrollable
	// share screen instead of the board.
	if (!turnState || !opponentJoined) {
		return (
			<MatchWaitingScreen
				title={bundle.session.title}
				gameTitle={messages.catalog.backgammon.title}
				status={backgammon.waitingRoom.shareToClaimBlackSeat}
				seats={seatCards}
				error={error}
				shareLabel={backgammon.waitingRoom.challengeLinkLabel}
				shareUrl={shareUrl}
				participants={bundle.participants}
			/>
		);
	}

	return (
		<FullscreenGameShell
			title={bundle.session.title}
			hud={
				<MatchHud
					infoLabel={backgammon.waitingRoom.infoButton}
					onInfo={() => setShowInfo((open) => !open)}
				>
					{error ? (
						<span className="max-w-[50vw] truncate rounded-xl bg-orange-950/70 px-3 py-2 text-xs text-orange-200 backdrop-blur">
							{error}
						</span>
					) : null}
				</MatchHud>
			}
		>
			<MatchStage
				designWidth={BACKGAMMON_DESIGN_WIDTH}
				insetClassName="landscape:pt-1 landscape:pl-14"
				board={
					<BackgammonBoard
						state={turnState}
						interactive={myTurn}
						canRoll={myTurn && turnState.dice.length === 0}
						canEndTurn={myTurn && canEndBackgammonTurn(turnState)}
						options={options}
						optionKeys={ONLINE_OPTION_KEYS}
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
												(bundle.state?.activeColor === "white" ? white : black)
													?.displayName ??
												colorLabel(backgammon.board, turnState.activeColor),
										})
						}
					/>
				}
			>
				<RotateHint />
			</MatchStage>
			{finished && !showInfo ? (
				<MatchOverlay>
					<div className="mx-auto max-w-md">
						<GameEndScreen
							heading={fmt(backgammon.waitingRoom.winsTheMatch, {
								name:
									winner?.displayName ?? backgammon.waitingRoom.someoneFallback,
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
								localColor && participantId
									? () =>
											run(
												() =>
													rematch({
														sessionId: bundle.session._id,
														participantId,
													}),
												backgammon.waitingRoom.rematchError,
											)
									: undefined
							}
							rematchLabel={backgammon.waitingRoom.rematchLabel}
							newGameRoute={getGameRoute("backgammon")}
						/>
					</div>
				</MatchOverlay>
			) : null}
			{showInfo ? (
				<GameInfoOverlay
					status={
						finished
							? fmt(backgammon.waitingRoom.winsTheMatch, {
									name:
										winner?.displayName ??
										backgammon.waitingRoom.someoneFallback,
								})
							: localColor
								? fmt(backgammon.waitingRoom.youArePlaying, {
										color: colorLabel(backgammon.board, localColor),
									})
								: backgammon.waitingRoom.bothSeatsClaimed
					}
					seats={seatCards}
					shareLabel={backgammon.waitingRoom.challengeLinkLabel}
					shareUrl={shareUrl}
					participants={bundle.participants}
					extra={<BackgammonMoveLog moves={bundle.moves} />}
					onClose={() => setShowInfo(false)}
				/>
			) : null}
		</FullscreenGameShell>
	);
}

/** How many of a side's checkers sit on the bar and are borne off. */
function SeatCounts({ counts }: { counts?: string }) {
	return counts ? (
		<p className="mt-2 text-xs text-slate-400">{counts}</p>
	) : null;
}

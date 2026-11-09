import { describeBluffClaim } from "@arcadeclub/core/bluff-dice";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import {
	RoomFrame,
	RoomLoading,
	RoomPlayAgain,
	RoomStartButton,
} from "#/components/games/RoomFrame";
import { useSeatAction } from "#/lib/games/use-seat-action";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Bundle = NonNullable<FunctionReturnType<typeof api.bluffDice.getBundle>>;

const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function BluffDiceRoom({
	bundle,
	joinUrl,
}: {
	bundle: Bundle;
	joinUrl: string;
}) {
	const { messages, locale } = useI18n();
	const bluffDice = messages.games.bluffDice;
	const start = useMutation(api.bluffDice.start);
	const submitClaim = useMutation(api.bluffDice.submitClaim);
	const challenge = useMutation(api.bluffDice.challenge);
	const rematch = useMutation(api.bluffDice.rematch);
	const { participantId, seatAction, error } = useSeatAction(
		bundle.session._id,
	);
	const [quantity, setQuantity] = useState(2);
	const [face, setFace] = useState(3);

	const state = bundle.state;
	const myDice = useQuery(
		api.bluffDice.getMyDice,
		participantId && state && state.phase !== "lobby"
			? {
					sessionId: bundle.session._id,
					participantId,
				}
			: "skip",
	);

	if (!state) {
		return <RoomLoading />;
	}

	const nameOf = (id: Id<"sessionParticipants">) =>
		bundle.participants.find((participant) => participant._id === id)
			?.displayName ?? bluffDice.room.playerFallback;
	const inLobby = state.phase === "lobby";
	const finished = state.phase === "finished";
	const activeId = state.turnOrder[state.activeIndex];
	const myTurn = !inLobby && !finished && activeId === participantId;
	const isHost = bundle.session.hostParticipantId === participantId;
	const lastClaim = state.claimHistory.at(-1);
	const totalDice = state.diceCounts.reduce(
		(sum, entry) => sum + entry.count,
		0,
	);

	const statusLabel = inLobby
		? bluffDice.room.waitingForPlayers
		: finished
			? fmt(bluffDice.room.winsTable, {
					name: state.winnerParticipantId
						? nameOf(state.winnerParticipantId)
						: bluffDice.room.someoneFallback,
				})
			: myTurn
				? lastClaim
					? bluffDice.room.yourTurnRaiseOrChallenge
					: bluffDice.room.yourTurnFirstClaim
				: fmt(bluffDice.room.waitingForPlayer, { name: nameOf(activeId) });

	return (
		<RoomFrame
			gameTitle={messages.catalog["bluff-dice"].title}
			title={bundle.session.title}
			joinCode={bundle.session.joinCode}
			status={statusLabel}
			inLobby={inLobby}
			error={error}
			joinUrl={joinUrl}
			howToPlay={{
				heading: bluffDice.room.howToPlayKicker,
				steps: [
					bluffDice.room.howToPlayRollDice,
					bluffDice.room.howToPlayClaim,
					bluffDice.room.howToPlayOutrank,
					bluffDice.room.howToPlayLoseDie,
				],
			}}
			panel={
				<>
					<ul className="mt-4 grid gap-2 sm:grid-cols-2">
						{(inLobby
							? bundle.participants.map((participant) => ({
									participantId: participant._id,
									count: undefined as number | undefined,
								}))
							: state.diceCounts
						).map((entry) => (
							<li
								key={entry.participantId}
								className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
									!inLobby && !finished && entry.participantId === activeId
										? "border-cyan-300/40 bg-cyan-300/10"
										: "border-white/10 bg-white/5"
								} ${entry.count === 0 ? "opacity-50" : ""}`}
							>
								<span className="truncate text-sm font-bold text-white">
									{nameOf(entry.participantId)}
								</span>
								{entry.count !== undefined ? (
									<span className="text-sm text-slate-300">
										{entry.count === 0
											? bluffDice.room.diceOut
											: plural(locale, entry.count, bluffDice.room.diceCount)}
									</span>
								) : null}
							</li>
						))}
					</ul>

					{inLobby && isHost && participantId ? (
						<RoomStartButton
							label={bluffDice.room.startGameButton}
							onClick={seatAction(start, bluffDice.room.couldNotStartGame)}
						/>
					) : null}
				</>
			}
		>
			{state.lastReveal ? (
				<div className="club-panel rounded-lg p-4">
					<p className="club-kicker mb-2">
						{bluffDice.room.lastChallengeKicker}
					</p>
					<p className="text-sm text-slate-200">
						{fmt(bluffDice.room.challengeSummary, {
							challenger: nameOf(state.lastReveal.challengerParticipantId),
							claimant: nameOf(state.lastReveal.claim.byParticipantId),
							claim: describeBluffClaim(state.lastReveal.claim),
							actual: state.lastReveal.actualCount,
						})}{" "}
						<span className="font-bold text-orange-200">
							{fmt(bluffDice.room.loserLosesDie, {
								name: nameOf(state.lastReveal.loserParticipantId),
							})}
						</span>
					</p>
					<div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-300">
						{state.lastReveal.hands.map((hand) => (
							<span key={hand.participantId}>
								{nameOf(hand.participantId)}:{" "}
								<span className="text-lg text-white">
									{hand.values.map((value) => DIE_FACES[value]).join(" ")}
								</span>
							</span>
						))}
					</div>
				</div>
			) : null}

			{!inLobby && !finished ? (
				<div className="club-panel rounded-lg p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="club-kicker mb-1">
								{bluffDice.room.yourDiceKicker}
							</p>
							<p className="text-3xl text-white">
								{myDice
									? myDice.map((value) => DIE_FACES[value]).join(" ")
									: "—"}
							</p>
						</div>
						<div className="text-right text-sm text-slate-300">
							<p>
								{fmt(bluffDice.room.roundLabel, {
									number: state.roundNumber,
								})}
							</p>
							<p>{plural(locale, totalDice, bluffDice.room.diceOnTable)}</p>
						</div>
					</div>
					{lastClaim ? (
						<p className="mt-3 text-sm text-slate-200">
							{fmt(bluffDice.room.currentClaimBy, {
								name: nameOf(lastClaim.byParticipantId),
							})}{" "}
							<span className="font-bold text-white">
								{describeBluffClaim(lastClaim)}
							</span>
						</p>
					) : (
						<p className="mt-3 text-sm text-slate-400">
							{bluffDice.room.noClaimYet}
						</p>
					)}
					{myTurn && participantId ? (
						<div className="mt-4 flex flex-wrap items-end gap-3">
							<label>
								<span className="mb-1 club-field-label">
									{bluffDice.room.quantityLabel}
								</span>
								<select
									value={quantity}
									onChange={(event) => setQuantity(Number(event.target.value))}
									className="rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
								>
									{Array.from({ length: totalDice }, (_, i) => i + 1).map(
										(value) => (
											<option key={value} value={value}>
												{value}
											</option>
										),
									)}
								</select>
							</label>
							<label>
								<span className="mb-1 club-field-label">
									{bluffDice.room.faceLabel}
								</span>
								<select
									value={face}
									onChange={(event) => setFace(Number(event.target.value))}
									className="rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
								>
									{[1, 2, 3, 4, 5, 6].map((value) => (
										<option key={value} value={value}>
											{value}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								className="min-h-11 club-btn-primary"
								onClick={seatAction(
									(seat) => submitClaim({ ...seat, quantity, face }),
									bluffDice.room.couldNotClaim,
								)}
							>
								{bluffDice.room.claimButton}
							</button>
							{lastClaim ? (
								<button
									type="button"
									className="min-h-11 rounded-md border border-orange-300/40 bg-orange-300/10 px-5 py-2 font-bold text-orange-100"
									onClick={seatAction(
										challenge,
										bluffDice.room.couldNotChallenge,
									)}
								>
									{bluffDice.room.challengeButton}
								</button>
							) : null}
						</div>
					) : null}
				</div>
			) : null}

			{finished && isHost && participantId ? (
				<RoomPlayAgain
					label={messages.common.actions.playAgain}
					onClick={seatAction(rematch, messages.common.match.rematchError)}
				/>
			) : null}
		</RoomFrame>
	);
}

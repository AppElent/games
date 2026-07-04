import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import {
	CONNECT_FOUR_COLS,
	CONNECT_FOUR_ROWS,
	type ConnectFourCell,
	type ConnectFourColor,
	getCell,
	isColumnFull,
} from "#/lib/games/connect-four";
import { getUserErrorMessage } from "#/lib/games/errors";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
		phase: "waiting" | "active" | "finished";
		redParticipantId?: Id<"sessionParticipants">;
		yellowParticipantId?: Id<"sessionParticipants">;
		board: ConnectFourCell[];
		activeColor: ConnectFourColor;
		resultOutcome?: "connect" | "draw" | "resignation";
		resultWinner?: ConnectFourColor;
	} | null;
};

export function ConnectFourMatch({
	bundle,
	shareUrl,
}: {
	bundle: Bundle;
	shareUrl: string;
}) {
	const drop = useMutation(api.connectFour.drop);
	const resign = useMutation(api.connectFour.resign);
	const rematch = useMutation(api.connectFour.rematch);
	const [participantId, setParticipantId] = useState<string>();
	const [error, setError] = useState("");

	useEffect(() => {
		setParticipantId(
			window.sessionStorage.getItem("arcade-club.participantId") ?? undefined,
		);
	}, []);

	const state = bundle.state;
	if (!state) {
		return (
			<div className="club-panel rounded-lg p-6 text-center">
				<p className="club-kicker mb-2">Setting up</p>
				<h2 className="club-title text-2xl font-bold text-white">
					Board is loading
				</h2>
			</div>
		);
	}

	const red = bundle.participants.find(
		(participant) => participant._id === state.redParticipantId,
	);
	const yellow = bundle.participants.find(
		(participant) => participant._id === state.yellowParticipantId,
	);
	const localColor: ConnectFourColor | undefined =
		state.redParticipantId === participantId
			? "red"
			: state.yellowParticipantId === participantId
				? "yellow"
				: undefined;
	const opponentJoined = Boolean(
		state.redParticipantId && state.yellowParticipantId,
	);
	const finished = state.phase === "finished";
	const myTurn =
		Boolean(localColor) &&
		state.activeColor === localColor &&
		opponentJoined &&
		!finished;

	const statusLabel = finished
		? state.resultOutcome === "draw"
			? "Draw — the board is full"
			: `${state.resultWinner === "red" ? (red?.displayName ?? "Red") : (yellow?.displayName ?? "Yellow")} wins${state.resultOutcome === "resignation" ? " by resignation" : ""}!`
		: !opponentJoined
			? "Share the link with one opponent to claim the yellow seat."
			: myTurn
				? "Your move — pick a column."
				: `Waiting for ${state.activeColor === "red" ? (red?.displayName ?? "red") : (yellow?.displayName ?? "yellow")}.`;

	async function run(action: () => Promise<unknown>, fallback: string) {
		setError("");
		try {
			await action();
		} catch (caught) {
			setError(getUserErrorMessage(caught, fallback));
		}
	}

	function handleDrop(column: number) {
		if (
			!myTurn ||
			!participantId ||
			!state ||
			isColumnFull(state.board, column)
		) {
			return;
		}
		run(
			() =>
				drop({
					sessionId: bundle.session._id,
					participantId: participantId as Id<"sessionParticipants">,
					column,
				}),
			"Could not drop",
		);
	}

	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
			<section className="space-y-4">
				<div className="club-panel rounded-lg p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="club-kicker mb-2">Connect Four</p>
							<h1 className="club-title text-3xl font-bold text-white">
								{bundle.session.title}
							</h1>
						</div>
					</div>
					<div className="mt-4">
						<SeatBanner
							tone={finished || opponentJoined ? "success" : "warning"}
							label={statusLabel}
						/>
					</div>
					<div className="mt-4 grid gap-3 md:grid-cols-2">
						<DiscCard
							color="red"
							name={red?.displayName ?? "Open seat"}
							active={
								!finished && opponentJoined && state.activeColor === "red"
							}
							open={!red}
						/>
						<DiscCard
							color="yellow"
							name={yellow?.displayName ?? "Open seat"}
							active={
								!finished && opponentJoined && state.activeColor === "yellow"
							}
							open={!yellow}
						/>
					</div>
					{error ? (
						<p className="mt-3 text-sm text-orange-200">{error}</p>
					) : null}
				</div>

				<div className="mx-auto w-full max-w-[480px]">
					<div className="rounded-xl border border-white/10 bg-sky-950/60 p-2 sm:p-3">
						<div className="grid grid-cols-7 gap-1 sm:gap-2">
							{Array.from({ length: CONNECT_FOUR_ROWS }).map((_, row) =>
								Array.from({ length: CONNECT_FOUR_COLS }).map((__, col) => {
									const cell = getCell(state.board, row, col);
									return (
										<button
											// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
											key={`${row}-${col}`}
											type="button"
											aria-label={`Drop in column ${col + 1}`}
											disabled={!myTurn || isColumnFull(state.board, col)}
											onClick={() => handleDrop(col)}
											className="flex aspect-square items-center justify-center rounded-full bg-black/40"
										>
											{cell !== "empty" ? (
												<span
													className={`block h-[85%] w-[85%] rounded-full ${
														cell === "red"
															? "bg-gradient-to-br from-red-400 to-red-600"
															: "bg-gradient-to-br from-yellow-300 to-amber-500"
													}`}
												/>
											) : (
												<span className="sr-only">empty</span>
											)}
										</button>
									);
								}),
							)}
						</div>
					</div>
				</div>

				<div className="flex flex-wrap justify-center gap-3">
					{localColor && !finished && opponentJoined ? (
						<button
							type="button"
							className="rounded-md border border-orange-300/40 bg-orange-300/10 px-4 py-2 text-sm font-bold text-orange-100"
							onClick={() =>
								run(
									() =>
										resign({
											sessionId: bundle.session._id,
											participantId: participantId as Id<"sessionParticipants">,
										}),
									"Could not resign",
								)
							}
						>
							Resign
						</button>
					) : null}
					{finished && localColor ? (
						<button
							type="button"
							className="rounded-md bg-white px-5 py-2.5 font-bold text-slate-950"
							onClick={() =>
								run(
									() =>
										rematch({
											sessionId: bundle.session._id,
											participantId: participantId as Id<"sessionParticipants">,
										}),
									"Could not start rematch",
								)
							}
						>
							Rematch (colors swap)
						</button>
					) : null}
				</div>
			</section>
			<aside className="space-y-4">
				<QrSharePanel label="Challenge link" url={shareUrl} />
				<ParticipantList participants={bundle.participants} />
			</aside>
		</div>
	);
}

function DiscCard({
	color,
	name,
	active = false,
	open = false,
}: {
	color: ConnectFourColor;
	name: string;
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
				<p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
					<span
						className={`inline-block h-3 w-3 rounded-full ${
							color === "red" ? "bg-red-500" : "bg-yellow-400"
						}`}
					/>
					{color}
				</p>
				{active ? (
					<span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
						Turn
					</span>
				) : null}
			</div>
			<p className="mt-1 truncate text-lg font-bold text-white">{name}</p>
		</div>
	);
}

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import type {
	BackgammonColor,
	BackgammonMoveDestination,
	BackgammonMoveSource,
	BackgammonPoint,
} from "#/lib/games/backgammon";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackgammonBoard } from "./BackgammonBoard";
import { BackgammonControls } from "./BackgammonControls";
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
	const [selectedSource, setSelectedSource] = useState<BackgammonMoveSource>();
	const [error, setError] = useState("");

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
	const localColor =
		bundle.state?.whiteParticipantId === participantId
			? "white"
			: bundle.state?.blackParticipantId === participantId
				? "black"
				: undefined;
	const opponentJoined = Boolean(bundle.state?.blackParticipantId);
	const canAct =
		Boolean(participantId) &&
		Boolean(localColor) &&
		bundle.state?.activeColor === localColor &&
		Boolean(bundle.state?.blackParticipantId);
	const canMove =
		canAct &&
		Boolean(bundle.state?.dice.length) &&
		(bundle.state?.usedDice.length ?? 0) < (bundle.state?.dice.length ?? 0);

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
			setError(
				caught instanceof Error ? caught.message : "Could not roll dice",
			);
		}
	}

	async function handleMove(to: BackgammonMoveDestination) {
		if (!participantId || selectedSource === undefined) {
			return;
		}
		setError("");
		try {
			await applyMove({
				sessionId: bundle.session._id,
				participantId: participantId as Id<"sessionParticipants">,
				from: selectedSource,
				to,
			});
			setSelectedSource(undefined);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not move");
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
			setSelectedSource(undefined);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not end turn");
		}
	}

	return (
		<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
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
							tone={opponentJoined ? "success" : "warning"}
							label={
								opponentJoined
									? localColor
										? `You are playing ${localColor}.`
										: "Both seats are claimed."
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
							active={bundle.state?.activeColor === "white"}
						/>
						<SeatCard
							label="Black"
							name={black?.displayName ?? "Open seat"}
							counts={
								bundle.state
									? `Bar ${bundle.state.bar.black} / Off ${bundle.state.off.black}`
									: undefined
							}
							active={bundle.state?.activeColor === "black"}
							open={!black}
						/>
					</div>
				</div>

				{bundle.state ? (
					<>
						<BackgammonControls
							activeColor={bundle.state.activeColor}
							dice={bundle.state.dice}
							usedDice={bundle.state.usedDice}
							canAct={canAct}
							error={error}
							onRoll={handleRoll}
							onEndTurn={handleEndTurn}
						/>
						<BackgammonBoard
							points={bundle.state.points}
							selectedSource={selectedSource}
							activeColor={bundle.state.activeColor}
							canMove={canMove}
							onSelectSource={(source) => {
								setError("");
								setSelectedSource(source);
							}}
							onSelectDestination={handleMove}
						/>
					</>
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

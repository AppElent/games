import { Link } from "@tanstack/react-router";
import { Pause, Play, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import type { PuzzleStateDoc } from "./useSoloPuzzleSession";

type PuzzleStatus = PuzzleStateDoc["status"];

/** Title, puzzle details, the clock and the pause toggle above a board. */
export function PuzzleHeader({
	title,
	details,
	status,
	elapsedLabel,
	onTogglePause,
}: {
	title: ReactNode;
	details: ReactNode;
	status: PuzzleStatus;
	elapsedLabel: string;
	onTogglePause: () => void;
}) {
	const messages = useMessages();
	return (
		<div className="flex w-full flex-wrap items-center justify-between gap-2">
			<div className="min-w-0">
				{title}
				<p className="text-xs text-slate-400">{details}</p>
			</div>
			<div className="flex items-center gap-2">
				<span className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 bg-slate-800/70 px-2 py-1 font-mono text-sm text-slate-200">
					<Timer className="h-4 w-4" /> {elapsedLabel}
				</span>
				{status !== "completed" ? (
					<button
						type="button"
						onClick={onTogglePause}
						className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 bg-slate-800/70 px-2 py-1 text-sm font-semibold text-slate-200 hover:bg-slate-700"
					>
						{status === "active" ? (
							<>
								<Pause className="h-4 w-4" />{" "}
								{messages.games.sudoku.game.pauseButton}
							</>
						) : (
							<>
								<Play className="h-4 w-4" /> {messages.common.gameShell.resume}
							</>
						)}
					</button>
				) : null}
			</div>
		</div>
	);
}

/** The solved notice, with the time taken and a way to the next puzzle. */
export function CompletedBanner({ elapsedLabel }: { elapsedLabel: string }) {
	const sudoku = useMessages().games.sudoku;
	return (
		<div className="w-full rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-4 py-3 text-emerald-200">
			<p className="font-bold">{sudoku.game.solvedTitle}</p>
			<p className="text-sm">
				{fmt(sudoku.game.completedIn, { time: elapsedLabel })}{" "}
				<Link to="/sudoku/new" className="underline hover:text-white">
					{sudoku.game.startAnotherPuzzle}
				</Link>
			</p>
		</div>
	);
}

/** Covers a paused board; a tap anywhere resumes. */
export function PauseOverlay({ onResume }: { onResume: () => void }) {
	const sudoku = useMessages().games.sudoku;
	return (
		<button
			type="button"
			onClick={onResume}
			className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-950/80 text-slate-200"
		>
			<Play className="h-10 w-10" />
			<span className="font-bold">{sudoku.game.pausedOverlay}</span>
		</button>
	);
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Camera, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import type { SudokuDifficulty } from "#/lib/games/sudoku";
import { generatePuzzle, gridToString } from "#/lib/games/sudoku";
import type { LocalSudokuSession } from "#/lib/games/sudoku-local";
import {
	autoSessionTitle,
	forgetLocalSudokuSession,
	listLocalSudokuSessions,
	rememberLocalSudokuSession,
} from "#/lib/games/sudoku-local";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/sudoku/new")({
	component: SudokuNewPage,
	staticData: { fullscreen: true },
});

const DIFFICULTIES: {
	id: SudokuDifficulty;
	label: string;
	blurb: string;
}[] = [
	{ id: "easy", label: "Easy", blurb: "Plenty of clues, gentle start" },
	{ id: "medium", label: "Medium", blurb: "Singles and simple pairs" },
	{ id: "hard", label: "Hard", blurb: "Pointing pairs and reductions" },
	{ id: "expert", label: "Expert", blurb: "Sparse clues, deep scanning" },
];

function SudokuNewPage() {
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.sudoku.createState);
	const [busy, setBusy] = useState<SudokuDifficulty | null>(null);
	const [error, setError] = useState("");
	const [name, setName] = useState("");
	const [recent, setRecent] = useState<LocalSudokuSession[]>([]);

	useEffect(() => {
		setRecent(listLocalSudokuSessions());
	}, []);

	const start = async (difficulty: SudokuDifficulty) => {
		setBusy(difficulty);
		setError("");
		try {
			const puzzle = generatePuzzle(difficulty);
			const guest = getOrCreateGuestIdentity();
			const title = name.trim() || autoSessionTitle(difficulty, "generated");
			const result = await createSession({
				gameType: "sudoku",
				joinMode: "solo",
				authPolicy: "guestAllowed",
				title,
				displayName: guest.displayName,
				guestId: guest.id,
			});
			await createState({
				sessionId: result.sessionId,
				source: "generated",
				difficulty,
				givens: gridToString(puzzle.givens),
				solution: gridToString(puzzle.solution),
			});
			rememberLocalSudokuSession({
				sessionId: result.sessionId,
				title,
				difficulty,
				source: "generated",
				createdAt: Date.now(),
			});
			window.location.href = `/sudoku/${result.sessionId}`;
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not start the puzzle"));
			setBusy(null);
		}
	};

	return (
		<FullscreenGamePage title="Sudoku">
			<p className="club-kicker mb-2">Sudoku</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Start a puzzle
			</h1>
			<p className="mb-6 max-w-2xl text-slate-300">
				Pick a difficulty and play solo. Your progress saves automatically, and
				you can keep several puzzles going at once.
			</p>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}

			<label className="mb-6 block max-w-md">
				<span className="mb-1 block text-sm font-semibold text-slate-300">
					Puzzle name (optional)
				</span>
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Auto-named by level and time"
					maxLength={80}
					className="w-full rounded-md border border-slate-600 bg-slate-800/70 px-3 py-2 text-white placeholder:text-slate-500"
				/>
			</label>

			<div className="mb-8 grid max-w-3xl gap-3 sm:grid-cols-2">
				{DIFFICULTIES.map((entry) => (
					<button
						key={entry.id}
						type="button"
						disabled={busy !== null}
						onClick={() => start(entry.id)}
						className="rounded-lg border border-slate-600/70 bg-slate-800/60 px-5 py-4 text-left transition hover:border-sky-400/70 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<span className="block text-lg font-bold text-white">
							{busy === entry.id ? "Generating..." : entry.label}
						</span>
						<span className="text-sm text-slate-400">{entry.blurb}</span>
					</button>
				))}
			</div>

			<Link
				to="/sudoku/scan"
				className="mb-10 inline-flex items-center gap-2 rounded-md border border-slate-600/70 bg-slate-800/60 px-4 py-3 font-semibold text-slate-200 transition hover:border-sky-400/70"
			>
				<Camera className="h-5 w-5" /> Scan a paper puzzle instead
			</Link>

			{recent.length > 0 ? (
				<section className="max-w-3xl">
					<h2 className="mb-3 text-xl font-bold text-white">Your puzzles</h2>
					<ul className="space-y-2">
						{recent.map((entry) => (
							<li
								key={entry.sessionId}
								className="flex items-center justify-between gap-3 rounded-md border border-slate-700/70 bg-slate-800/40 px-4 py-2"
							>
								<a
									href={`/sudoku/${entry.sessionId}`}
									className="min-w-0 flex-1 truncate font-semibold text-slate-200 hover:text-sky-300"
								>
									{entry.title}
								</a>
								<span className="text-xs text-slate-500">
									{new Date(entry.createdAt).toLocaleDateString()}
								</span>
								<button
									type="button"
									aria-label={`Remove ${entry.title} from this list`}
									onClick={() => {
										forgetLocalSudokuSession(entry.sessionId);
										setRecent(listLocalSudokuSessions());
									}}
									className="text-slate-500 hover:text-orange-300"
								>
									<X className="h-4 w-4" />
								</button>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</FullscreenGamePage>
	);
}

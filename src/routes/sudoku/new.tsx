import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Camera, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	binaryGridToString,
	generateBinaryPuzzle,
} from "#/lib/games/binary-puzzle";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import type { SudokuDifficulty } from "#/lib/games/sudoku";
import { generatePuzzle, gridToString } from "#/lib/games/sudoku";
import { generateKillerPuzzle } from "#/lib/games/sudoku-killer";
import type { LocalSudokuSession } from "#/lib/games/sudoku-local";
import {
	autoSessionTitle,
	forgetLocalSudokuSession,
	listLocalSudokuSessions,
	rememberLocalSudokuSession,
} from "#/lib/games/sudoku-local";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/sudoku/new")({
	component: SudokuNewPage,
	staticData: { fullscreen: true },
});

type SudokuVariant = "classic" | "killer" | "binary";

function SudokuNewPage() {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const VARIANTS: { id: SudokuVariant; label: string; blurb: string }[] = [
		{
			id: "classic",
			label: sudoku.variant.classic,
			blurb: sudoku.newGame.variantBlurbClassic,
		},
		{
			id: "killer",
			label: sudoku.variant.killer,
			blurb: sudoku.newGame.variantBlurbKiller,
		},
		{
			id: "binary",
			label: sudoku.variant.binary,
			blurb: sudoku.newGame.variantBlurbBinary,
		},
	];
	const DIFFICULTIES: {
		id: SudokuDifficulty;
		label: string;
		blurb: Record<SudokuVariant, string>;
	}[] = [
		{
			id: "easy",
			label: sudoku.difficulty.easy,
			blurb: sudoku.newGame.difficultyBlurbs.easy,
		},
		{
			id: "medium",
			label: sudoku.difficulty.medium,
			blurb: sudoku.newGame.difficultyBlurbs.medium,
		},
		{
			id: "hard",
			label: sudoku.difficulty.hard,
			blurb: sudoku.newGame.difficultyBlurbs.hard,
		},
		{
			id: "expert",
			label: sudoku.difficulty.expert,
			blurb: sudoku.newGame.difficultyBlurbs.expert,
		},
	];
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.sudoku.createState);
	const [variant, setVariant] = useState<SudokuVariant>("classic");
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
			const guest = getOrCreateGuestIdentity();
			const title =
				name.trim() ||
				autoSessionTitle(difficulty, "generated", new Date(), variant);
			const result = await createSession({
				gameType: "sudoku",
				joinMode: "solo",
				authPolicy: "guestAllowed",
				title,
				displayName: guest.displayName,
				guestId: guest.id,
			});
			if (variant === "binary") {
				const puzzle = generateBinaryPuzzle(difficulty);
				await createState({
					sessionId: result.sessionId,
					source: "generated",
					difficulty,
					variant: "binary",
					size: puzzle.size,
					givens: binaryGridToString(puzzle.givens),
					solution: binaryGridToString(puzzle.solution),
				});
			} else if (variant === "killer") {
				const puzzle = generateKillerPuzzle(difficulty);
				await createState({
					sessionId: result.sessionId,
					source: "generated",
					difficulty,
					variant: "killer",
					cages: puzzle.cages,
					givens: gridToString(puzzle.givens),
					solution: gridToString(puzzle.solution),
				});
			} else {
				const puzzle = generatePuzzle(difficulty);
				await createState({
					sessionId: result.sessionId,
					source: "generated",
					difficulty,
					givens: gridToString(puzzle.givens),
					solution: gridToString(puzzle.solution),
				});
			}
			rememberLocalSudokuSession({
				sessionId: result.sessionId,
				title,
				difficulty,
				source: "generated",
				createdAt: Date.now(),
			});
			window.location.href = `/sudoku/${result.sessionId}`;
		} catch (caught) {
			setError(getUserErrorMessage(caught, sudoku.newGame.couldNotStart));
			setBusy(null);
		}
	};

	return (
		<FullscreenGamePage title={messages.catalog.sudoku.title}>
			<p className="club-kicker mb-2">{messages.catalog.sudoku.title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{sudoku.newGame.heading}
			</h1>
			<p className="mb-6 max-w-2xl text-slate-300">{sudoku.newGame.intro}</p>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}

			<label className="mb-6 block max-w-md">
				<span className="mb-1 block text-sm font-semibold text-slate-300">
					{sudoku.newGame.nameLabel}
				</span>
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder={sudoku.newGame.namePlaceholder}
					maxLength={80}
					className="w-full rounded-md border border-slate-600 bg-slate-800/70 px-3 py-2 text-white placeholder:text-slate-500"
				/>
			</label>

			<fieldset className="mb-6 max-w-3xl">
				<legend className="mb-2 block text-sm font-semibold text-slate-300">
					{sudoku.newGame.gameTypeLegend}
				</legend>
				<div className="flex flex-wrap gap-2">
					{VARIANTS.map((entry) => (
						<button
							key={entry.id}
							type="button"
							aria-pressed={variant === entry.id}
							disabled={busy !== null}
							onClick={() => setVariant(entry.id)}
							title={entry.blurb}
							className={`min-h-11 rounded-md px-4 py-2 font-bold ${
								variant === entry.id
									? "bg-white text-slate-950"
									: "border border-white/20 bg-white/10 text-white"
							} disabled:cursor-not-allowed disabled:opacity-50`}
						>
							{entry.label}
						</button>
					))}
				</div>
				<p className="mt-2 text-sm text-slate-400">
					{VARIANTS.find((entry) => entry.id === variant)?.blurb}
				</p>
			</fieldset>

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
							{busy === entry.id ? sudoku.newGame.generating : entry.label}
						</span>
						<span className="text-sm text-slate-400">
							{entry.blurb[variant]}
						</span>
					</button>
				))}
			</div>

			<Link
				to="/sudoku/scan"
				className="mb-10 inline-flex items-center gap-2 rounded-md border border-slate-600/70 bg-slate-800/60 px-4 py-3 font-semibold text-slate-200 transition hover:border-sky-400/70"
			>
				<Camera className="h-5 w-5" /> {sudoku.newGame.scanInstead}
			</Link>

			{recent.length > 0 ? (
				<section className="max-w-3xl">
					<h2 className="mb-3 text-xl font-bold text-white">
						{sudoku.newGame.yourPuzzles}
					</h2>
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
									aria-label={fmt(sudoku.newGame.removeFromList, {
										title: entry.title,
									})}
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

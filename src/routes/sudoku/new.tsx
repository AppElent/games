import { generateBinaryPuzzle } from "@arcadeclub/core/binary-puzzle";
import { digitsToString } from "@arcadeclub/core/puzzle";
import type { SudokuDifficulty } from "@arcadeclub/core/sudoku";
import { generatePuzzle } from "@arcadeclub/core/sudoku";
import { generateKillerPuzzle } from "@arcadeclub/core/sudoku-killer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Camera, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import type { LocalSudokuSession } from "#/lib/games/sudoku-local";
import {
	autoSessionTitle,
	forgetLocalSudokuSession,
	listLocalSudokuSessions,
	rememberLocalSudokuSession,
} from "#/lib/games/sudoku-local";
import { useHostSession } from "#/lib/games/use-host-session";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/sudoku/new")({
	component: SudokuNewPage,
	staticData: { fullscreen: true },
});

type SudokuVariant = "classic" | "killer" | "binary";

/** A fresh puzzle in the shape `sudoku.create` stores. */
function generatedPuzzle(variant: SudokuVariant, difficulty: SudokuDifficulty) {
	if (variant === "binary") {
		const puzzle = generateBinaryPuzzle(difficulty);
		return {
			variant,
			size: puzzle.size,
			givens: digitsToString(puzzle.givens),
			solution: digitsToString(puzzle.solution),
		};
	}
	if (variant === "killer") {
		const puzzle = generateKillerPuzzle(difficulty);
		return {
			variant,
			cages: puzzle.cages,
			givens: digitsToString(puzzle.givens),
			solution: digitsToString(puzzle.solution),
		};
	}
	const puzzle = generatePuzzle(difficulty);
	return {
		givens: digitsToString(puzzle.givens),
		solution: digitsToString(puzzle.solution),
	};
}

function SudokuNewPage() {
	const messages = useMessages();
	const sudoku = messages.games.sudoku;
	const VARIANTS: { id: SudokuVariant; label: string; blurb: string }[] = [
		{
			id: "classic",
			label: sudoku.variant.classic,
			blurb: sudoku.newGame.variantBlurbs.classic,
		},
		{
			id: "killer",
			label: sudoku.variant.killer,
			blurb: sudoku.newGame.variantBlurbs.killer,
		},
		{
			id: "binary",
			label: sudoku.variant.binary,
			blurb: sudoku.newGame.variantBlurbs.binary,
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
	const create = useMutation(api.sudoku.create);
	const { busy: hosting, error, host } = useHostSession("sudoku");
	const [variant, setVariant] = useState<SudokuVariant>("classic");
	const [pending, setPending] = useState<SudokuDifficulty | null>(null);
	const busy = hosting ? pending : null;
	const [name, setName] = useState("");
	const [recent, setRecent] = useState<LocalSudokuSession[]>([]);

	useEffect(() => {
		setRecent(listLocalSudokuSessions());
	}, []);

	const start = (difficulty: SudokuDifficulty) => {
		setPending(difficulty);
		return host(async ({ guestId, guestName }) => {
			const title =
				name.trim() ||
				autoSessionTitle(difficulty, "generated", new Date(), variant);
			const created = await create({
				title,
				displayName: guestName,
				guestId,
				source: "generated",
				difficulty,
				...generatedPuzzle(variant, difficulty),
			});
			rememberLocalSudokuSession({
				sessionId: created.sessionId,
				title,
				difficulty,
				source: "generated",
				createdAt: Date.now(),
			});
			return created;
		}, sudoku.newGame.couldNotStart);
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

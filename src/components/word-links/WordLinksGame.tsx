import { useEffect, useState } from "react";
import {
	buildWordLinkShareText,
	createWordLinkAttempt,
	getSolvedTerms,
	shuffleTerms,
	sortGroupsByDifficulty,
	submitWordLinkGuess,
	type WordLinkAttempt,
	type WordLinkDifficulty,
	type WordLinkPuzzle,
} from "#/lib/games/word-links";
import {
	loadWordLinkAttempt,
	recordDailyResult,
	saveWordLinkAttempt,
} from "#/lib/games/word-links-local";

const GROUP_STYLES: Record<WordLinkDifficulty, string> = {
	easy: "bg-emerald-500/80 text-emerald-950",
	medium: "bg-yellow-400/80 text-yellow-950",
	hard: "bg-sky-400/80 text-sky-950",
	tricky: "bg-purple-400/80 text-purple-950",
};

type Props = {
	puzzle: WordLinkPuzzle;
	mode: "daily" | "practice";
};

export function WordLinksGame({ puzzle, mode }: Props) {
	const [attempt, setAttempt] = useState<WordLinkAttempt>(() => {
		const saved = loadWordLinkAttempt(puzzle.id);
		return saved ?? createWordLinkAttempt(puzzle);
	});
	const [selected, setSelected] = useState<string[]>([]);
	const [message, setMessage] = useState("");
	const [copied, setCopied] = useState(false);
	const [order, setOrder] = useState<string[]>(() => [...puzzle.terms]);

	const solvedTerms = getSolvedTerms(puzzle, attempt);
	const remaining = order.filter(
		(term) => !solvedTerms.has(term.toUpperCase()),
	);

	useEffect(() => {
		saveWordLinkAttempt(attempt);
	}, [attempt]);

	const finished = attempt.status !== "playing";

	function toggle(term: string) {
		if (finished) {
			return;
		}
		setMessage("");
		setSelected((current) =>
			current.includes(term)
				? current.filter((candidate) => candidate !== term)
				: current.length < 4
					? [...current, term]
					: current,
		);
	}

	function submit() {
		const { result, attempt: next } = submitWordLinkGuess(
			puzzle,
			attempt,
			selected,
		);
		setAttempt(next);
		if (result.type === "correct") {
			setSelected([]);
			setMessage(result.won ? "Solved! 🎉" : "Correct!");
			if (result.won && mode === "daily") {
				recordDailyResult(true);
			}
		} else if (result.type === "oneAway") {
			setMessage("One away...");
		} else if (result.type === "wrong") {
			setMessage("Not a group.");
		} else if (result.type === "duplicateGuess") {
			setMessage("Already tried that combination.");
		} else {
			setMessage(result.reason);
		}
		if ((result.type === "oneAway" || result.type === "wrong") && result.lost) {
			setMessage("Out of guesses — the groups are revealed below.");
			setSelected([]);
			if (mode === "daily") {
				recordDailyResult(false);
			}
		}
	}

	async function share() {
		const text = buildWordLinkShareText(puzzle, attempt);
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setMessage("Could not copy — select and copy manually.");
		}
	}

	const solvedGroups = attempt.solvedGroupIds
		.map((id) => puzzle.groups.find((group) => group.id === id))
		.filter((group) => group !== undefined);
	const revealGroups =
		attempt.status === "lost"
			? sortGroupsByDifficulty(
					puzzle.groups.filter(
						(group) => !attempt.solvedGroupIds.includes(group.id),
					),
				)
			: [];

	return (
		<div className="mx-auto w-full max-w-xl">
			<div className="mb-3 flex items-center justify-between">
				<p className="text-sm text-slate-300">
					Find four groups of four.{" "}
					{mode === "daily" ? "Today's puzzle." : "Practice puzzle."}
				</p>
				<p className="text-sm text-slate-300">
					<span className="sr-only">Mistakes remaining: </span>
					{"●".repeat(Math.max(0, attempt.mistakeLimit - attempt.mistakes))}
					{"○".repeat(attempt.mistakes)}
				</p>
			</div>

			<div className="space-y-2">
				{solvedGroups.map((group) => (
					<div
						key={group.id}
						className={`rounded-md px-3 py-2 text-center ${GROUP_STYLES[group.difficulty]}`}
					>
						<p className="text-sm font-bold uppercase tracking-wide">
							{group.label}
						</p>
						<p className="text-sm">{group.terms.join(", ")}</p>
					</div>
				))}
			</div>

			{remaining.length > 0 && attempt.status !== "lost" ? (
				<div className="mt-2 grid grid-cols-4 gap-2">
					{remaining.map((term) => {
						const isSelected = selected.includes(term);
						return (
							<button
								key={term}
								type="button"
								onClick={() => toggle(term)}
								aria-pressed={isSelected}
								className={`min-h-11 rounded-md px-1 py-2 text-xs font-bold uppercase sm:text-sm ${
									isSelected
										? "bg-white text-slate-950"
										: "bg-white/10 text-white hover:bg-white/20"
								}`}
							>
								{term}
							</button>
						);
					})}
				</div>
			) : null}

			{revealGroups.length > 0 ? (
				<div className="mt-2 space-y-2">
					{revealGroups.map((group) => (
						<div
							key={group.id}
							className={`rounded-md px-3 py-2 text-center opacity-70 ${GROUP_STYLES[group.difficulty]}`}
						>
							<p className="text-sm font-bold uppercase tracking-wide">
								{group.label}
							</p>
							<p className="text-sm">{group.terms.join(", ")}</p>
						</div>
					))}
				</div>
			) : null}

			{message ? (
				<output className="mt-3 block text-center text-sm text-orange-200">
					{message}
				</output>
			) : null}

			<div className="mt-4 flex flex-wrap justify-center gap-3">
				{!finished ? (
					<>
						<button
							type="button"
							disabled={selected.length !== 4}
							onClick={submit}
							className="min-h-11 rounded-md bg-white px-5 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Submit
						</button>
						<button
							type="button"
							onClick={() => setOrder((current) => shuffleTerms(current))}
							className="min-h-11 rounded-md border border-white/20 bg-white/10 px-5 py-2 font-bold text-white"
						>
							Shuffle
						</button>
						<button
							type="button"
							disabled={selected.length === 0}
							onClick={() => setSelected([])}
							className="min-h-11 rounded-md border border-white/20 bg-white/10 px-5 py-2 font-bold text-white disabled:opacity-50"
						>
							Deselect
						</button>
					</>
				) : (
					<button
						type="button"
						onClick={share}
						className="min-h-11 rounded-md bg-white px-5 py-2 font-bold text-slate-950"
					>
						{copied ? "Copied!" : "Share result"}
					</button>
				)}
			</div>
		</div>
	);
}

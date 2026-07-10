import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/sets/")({
	component: QuizSetsPage,
	staticData: { fullscreen: true },
});

function QuizSetsPage() {
	const messages = useI18n().messages;
	return (
		<FullscreenGamePage
			title={messages.common.dashboard.quizSets}
			maxWidthClassName="max-w-3xl"
		>
			<p className="club-kicker mb-2">{messages.catalog["live-quiz"].title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{messages.games.quiz.sets.heading}
			</h1>
			<p className="mb-6 max-w-2xl text-slate-300">
				{messages.games.quiz.sets.intro}
			</p>
			<HostGate>
				<QuizSetsList />
			</HostGate>
		</FullscreenGamePage>
	);
}

function QuizSetsList() {
	const { messages, locale } = useI18n();
	const mySets = useQuery(api.quiz.listMine);
	const sampleSets = useQuery(api.quiz.listSampleSets);
	const deleteSet = useMutation(api.quiz.deleteSet);

	return (
		<div className="space-y-5">
			<Link
				to="/quiz/sets/new"
				className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-5 py-2.5 font-bold text-slate-950 no-underline hover:bg-cyan-200"
			>
				<Plus className="h-4 w-4" />
				{messages.games.quiz.sets.newQuizSet}
			</Link>

			<div className="club-panel rounded-lg p-5">
				<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
					{messages.games.quiz.sets.mySets}
				</h2>
				{mySets === undefined ? (
					<p className="text-sm text-slate-400">
						{messages.common.errors.loading}
					</p>
				) : mySets.length === 0 ? (
					<p className="text-sm text-slate-400">
						{messages.games.quiz.sets.noSetsYet}
					</p>
				) : (
					<ul className="space-y-2">
						{mySets.map((set) => (
							<li
								key={set._id}
								className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-4 py-3"
							>
								<div className="min-w-0">
									<p className="truncate font-bold text-white">{set.title}</p>
									<p className="truncate text-sm text-slate-400">
										{plural(
											locale,
											set.questions.length,
											messages.games.quiz.questionsCount,
										)}
										{set.description
											? fmt(messages.games.quiz.sets.descriptionSuffix, {
													description: set.description,
												})
											: ""}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-1">
									<Link
										to="/quiz/sets/$quizSetId"
										params={{ quizSetId: set._id }}
										aria-label={fmt(messages.games.quiz.sets.editAriaLabel, {
											title: set.title,
										})}
										className="rounded p-2 text-slate-300 no-underline hover:bg-white/10 hover:text-white"
									>
										<Pencil className="h-4 w-4" />
									</Link>
									<button
										type="button"
										aria-label={fmt(messages.games.quiz.sets.deleteAriaLabel, {
											title: set.title,
										})}
										className="rounded p-2 text-slate-300 hover:bg-white/10 hover:text-orange-300"
										onClick={() => {
											if (
												window.confirm(
													fmt(messages.games.quiz.sets.deleteConfirm, {
														title: set.title,
													}),
												)
											) {
												void deleteSet({
													quizSetId: set._id as Id<"quizSets">,
												});
											}
										}}
									>
										<Trash2 className="h-4 w-4" />
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="club-panel rounded-lg p-5">
				<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
					{messages.games.quiz.sets.builtInSets}
				</h2>
				{sampleSets === undefined ? (
					<p className="text-sm text-slate-400">
						{messages.common.errors.loading}
					</p>
				) : (
					<ul className="space-y-2">
						{sampleSets.map((set) => (
							<li key={set._id} className="rounded-md bg-white/5 px-4 py-3">
								<p className="font-bold text-white">{set.title}</p>
								<p className="text-sm text-slate-400">
									{plural(
										locale,
										set.questions.length,
										messages.games.quiz.questionsCount,
									)}
									{set.description
										? fmt(messages.games.quiz.sets.descriptionSuffix, {
												description: set.description,
											})
										: ""}
								</p>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

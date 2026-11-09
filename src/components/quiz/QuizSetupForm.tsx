import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useHostSession } from "#/lib/games/use-host-session";
import { plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function QuizSetupForm() {
	const { messages, locale } = useI18n();
	const ensureSampleSet = useMutation(api.quiz.ensureSampleSet);
	const create = useMutation(api.quiz.create);
	const { busy, error, host } = useHostSession("live-quiz");
	const mySets = useQuery(api.quiz.listMine);
	const sampleSets = useQuery(api.quiz.listSampleSets);
	const [selectedSetId, setSelectedSetId] = useState("");

	// Default to your newest own set, otherwise the sample set.
	useEffect(() => {
		if (selectedSetId) {
			return;
		}
		if (mySets?.length) {
			setSelectedSetId(mySets[mySets.length - 1]._id);
		} else if (sampleSets?.length) {
			setSelectedSetId(sampleSets[0]._id);
		}
	}, [mySets, sampleSets, selectedSetId]);

	return (
		<div className="club-panel max-w-xl rounded-lg p-5">
			<p className="mb-5 text-slate-300">
				{messages.games.quiz.setupForm.intro}
			</p>
			<label
				className="mb-2 block text-sm font-bold text-slate-200"
				htmlFor="quiz-set"
			>
				{messages.games.quiz.setupForm.questionSetLabel}
			</label>
			<select
				id="quiz-set"
				value={selectedSetId}
				onChange={(event) => setSelectedSetId(event.target.value)}
				className="mb-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300"
			>
				{mySets?.length ? (
					<optgroup label={messages.games.quiz.sets.mySets}>
						{mySets.map((set) => (
							<option key={set._id} value={set._id}>
								{set.title} (
								{plural(
									locale,
									set.questions.length,
									messages.games.quiz.questionsCount,
								)}
								)
							</option>
						))}
					</optgroup>
				) : null}
				<optgroup label={messages.games.quiz.setupForm.builtIn}>
					{sampleSets?.map((set) => (
						<option key={set._id} value={set._id}>
							{set.title} (
							{plural(
								locale,
								set.questions.length,
								messages.games.quiz.questionsCount,
							)}
							)
						</option>
					))}
					{!sampleSets?.length ? (
						<option value="">
							{messages.games.quiz.setupForm.starterQuizFallback}
						</option>
					) : null}
				</optgroup>
			</select>
			<p className="mb-5 text-sm text-slate-400">
				{messages.games.quiz.setupForm.wantOwnQuestions}{" "}
				<Link to="/quiz/sets" className="text-cyan-200 underline">
					{messages.games.quiz.setupForm.manageQuizSets}
				</Link>
			</p>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<button
				type="button"
				disabled={busy}
				className="rounded-md bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
				onClick={() =>
					host(
						async ({ hostName, guestId }) =>
							create({
								title: messages.catalog["live-quiz"].title,
								displayName: hostName,
								guestId,
								quizSetId: selectedSetId
									? (selectedSetId as Id<"quizSets">)
									: await ensureSampleSet(),
							}),
						messages.games.quiz.setupForm.createRoomError,
					)
				}
			>
				{busy
					? messages.games.quiz.setupForm.creatingRoom
					: messages.games.quiz.setupForm.createQuizRoom}
			</button>
		</div>
	);
}

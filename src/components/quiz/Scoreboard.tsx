import { fmt, useMessages } from "#/lib/i18n";

type Participant = {
	_id: string;
	displayName: string;
	role: "host" | "player" | "watcher";
};

type Answer = {
	participantId: string;
	score: number;
	correct: boolean;
};

export function Scoreboard({
	participants,
	answers,
}: {
	participants: Participant[];
	answers: Answer[];
}) {
	const messages = useMessages();
	const totals = new Map<string, { score: number; correct: number }>();
	for (const answer of answers) {
		const current = totals.get(answer.participantId) ?? {
			score: 0,
			correct: 0,
		};
		current.score += answer.score;
		current.correct += answer.correct ? 1 : 0;
		totals.set(answer.participantId, current);
	}
	const rows = participants
		.filter((participant) => participant.role !== "host")
		.map((participant) => ({
			participant,
			score: totals.get(participant._id)?.score ?? 0,
			correct: totals.get(participant._id)?.correct ?? 0,
		}))
		.sort((a, b) => b.score - a.score);

	return (
		<section className="club-panel rounded-lg p-4">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
				{messages.common.results.scoreboard}
			</h2>
			{rows.length === 0 ? (
				<p className="text-sm text-slate-400">
					{messages.games.quiz.scoreboard.playersWillAppear}
				</p>
			) : (
				<ol className="space-y-2">
					{rows.map((row, index) => (
						<li
							key={row.participant._id}
							className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-md bg-white/5 px-3 py-2 text-sm"
						>
							<span className="text-slate-400">{index + 1}</span>
							<span className="font-semibold text-white">
								{row.participant.displayName}
							</span>
							<span className="text-right">
								<span className="block font-bold text-cyan-200">
									{row.score}
								</span>
								<span className="text-xs text-slate-400">
									{fmt(messages.games.quiz.scoreboard.correctCount, {
										count: row.correct,
									})}
								</span>
							</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}

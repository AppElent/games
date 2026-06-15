type Participant = {
	_id: string;
	displayName: string;
	role: "host" | "player" | "watcher";
	seat?: string;
	connected: boolean;
};

export function ParticipantList({
	participants,
}: {
	participants: Participant[];
}) {
	return (
		<div className="club-panel rounded-lg p-4">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
				Players
			</h2>
			<ul className="space-y-2">
				{participants.map((participant) => (
					<li
						key={participant._id}
						className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm"
					>
						<span className="font-semibold text-white">
							{participant.displayName}
						</span>
						<span className="text-slate-400">
							{participant.seat ?? participant.role}
							{participant.connected ? "" : " away"}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

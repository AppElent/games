import { Crown, UserX } from "lucide-react";
import { fmt, useMessages } from "#/lib/i18n";

type Participant = {
	_id: string;
	displayName: string;
	role: "host" | "player" | "watcher";
	seat?: string;
	connected: boolean;
	kickedAt?: number;
};

/**
 * Shared player list. Pass `hostControls` on host screens to enable
 * kick / transfer-host moderation buttons on non-host rows.
 */
export function ParticipantList({
	participants,
	hostControls,
}: {
	participants: Participant[];
	hostControls?: {
		onKick: (participantId: string) => void;
		onTransferHost: (participantId: string) => void;
	};
}) {
	const messages = useMessages();
	const roleLabel = (role: Participant["role"]): string => {
		if (role === "host") {
			return messages.common.session.host;
		}
		if (role === "watcher") {
			return messages.common.participants.watcher;
		}
		return messages.common.participants.player;
	};
	const visible = participants.filter((participant) => !participant.kickedAt);
	return (
		<div className="club-panel rounded-lg p-4">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
				{messages.common.participants.heading}
			</h2>
			<ul className="space-y-2">
				{visible.map((participant) => {
					const label = participant.seat ?? roleLabel(participant.role);
					return (
						<li
							key={participant._id}
							className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-2 text-sm"
						>
							<span className="min-w-0 truncate font-semibold text-white">
								{participant.displayName}
							</span>
							<span className="flex shrink-0 items-center gap-2 text-slate-400">
								{participant.connected
									? label
									: fmt(messages.common.participants.awayStatus, {
											role: label,
										})}
								{hostControls && participant.role !== "host" ? (
									<>
										<button
											type="button"
											title={fmt(messages.common.participants.makeHost, {
												name: participant.displayName,
											})}
											aria-label={fmt(messages.common.participants.makeHost, {
												name: participant.displayName,
											})}
											className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-amber-300"
											onClick={() =>
												hostControls.onTransferHost(participant._id)
											}
										>
											<Crown className="h-4 w-4" />
										</button>
										<button
											type="button"
											title={fmt(messages.common.participants.remove, {
												name: participant.displayName,
											})}
											aria-label={fmt(messages.common.participants.remove, {
												name: participant.displayName,
											})}
											className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-orange-300"
											onClick={() => hostControls.onKick(participant._id)}
										>
											<UserX className="h-4 w-4" />
										</button>
									</>
								) : null}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

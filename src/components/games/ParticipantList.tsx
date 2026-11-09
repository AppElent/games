import type { ReactNode } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";

export type ListedParticipant = {
	_id: Id<"sessionParticipants">;
	displayName: string;
	role: "host" | "player" | "watcher";
	seat?: string;
	connected: boolean;
	kickedAt?: number;
};

/**
 * Shared player list, without kicked players. `renderActions` adds controls
 * after a row's role, such as a host's moderation buttons.
 */
export function ParticipantList({
	participants,
	renderActions,
}: {
	participants: ListedParticipant[];
	renderActions?: (participant: ListedParticipant) => ReactNode;
}) {
	const messages = useMessages();
	const roleLabel = (role: ListedParticipant["role"]): string => {
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
			<h2 className="mb-3 club-panel-heading">
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
								{renderActions?.(participant)}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

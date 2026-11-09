import { Crown, UserX } from "lucide-react";
import type { ListedParticipant } from "#/components/games/ParticipantList";
import { fmt, useMessages } from "#/lib/i18n";

/** A participant row's host buttons: hand over hosting, remove. None for the host. */
export function ModerationActions({
	participant,
	onTransferHost,
	onKick,
}: {
	participant: ListedParticipant;
	onTransferHost: () => void;
	onKick: () => void;
}) {
	const messages = useMessages();
	if (participant.role === "host") {
		return null;
	}
	const makeHost = fmt(messages.common.participants.makeHost, {
		name: participant.displayName,
	});
	const remove = fmt(messages.common.participants.remove, {
		name: participant.displayName,
	});
	return (
		<>
			<button
				type="button"
				title={makeHost}
				aria-label={makeHost}
				className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-amber-300"
				onClick={onTransferHost}
			>
				<Crown className="h-4 w-4" />
			</button>
			<button
				type="button"
				title={remove}
				aria-label={remove}
				className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-orange-300"
				onClick={onKick}
			>
				<UserX className="h-4 w-4" />
			</button>
		</>
	);
}

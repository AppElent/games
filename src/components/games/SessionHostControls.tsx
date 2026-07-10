import { useMutation } from "convex/react";
import { Lock, LockOpen, Pencil } from "lucide-react";
import { useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Host-only room controls: lock the room against new joiners and rename
 * the session. Render only when the local participant is the host.
 */
export function SessionHostControls({
	sessionId,
	hostParticipantId,
	title,
	locked,
}: {
	sessionId: Id<"gameSessions">;
	hostParticipantId: Id<"sessionParticipants">;
	title: string;
	locked: boolean;
}) {
	const messages = useMessages();
	const setLocked = useMutation(api.sessions.setLocked);
	const rename = useMutation(api.sessions.rename);
	const [editing, setEditing] = useState(false);
	const [draftTitle, setDraftTitle] = useState(title);
	const [error, setError] = useState("");

	async function run(action: () => Promise<unknown>, fallback: string) {
		setError("");
		try {
			await action();
		} catch (caught) {
			setError(getUserErrorMessage(caught, fallback));
		}
	}

	return (
		<div className="club-panel rounded-lg p-4">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
				{messages.common.roomControls.heading}
			</h2>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
					onClick={() =>
						void run(
							() =>
								setLocked({
									sessionId,
									hostParticipantId,
									locked: !locked,
								}),
							messages.common.roomControls.lockError,
						)
					}
				>
					{locked ? (
						<>
							<Lock className="h-4 w-4 text-orange-300" />
							{messages.common.roomControls.lockedUnlock}
						</>
					) : (
						<>
							<LockOpen className="h-4 w-4 text-emerald-300" />
							{messages.common.roomControls.openLock}
						</>
					)}
				</button>
				<button
					type="button"
					className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
					onClick={() => {
						setDraftTitle(title);
						setEditing((value) => !value);
					}}
				>
					<Pencil className="h-4 w-4" />
					{messages.common.roomControls.rename}
				</button>
			</div>
			{editing ? (
				<form
					className="mt-3 flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						void run(
							() => rename({ sessionId, hostParticipantId, title: draftTitle }),
							messages.common.roomControls.renameError,
						).then(() => setEditing(false));
					}}
				>
					<input
						value={draftTitle}
						onChange={(event) => setDraftTitle(event.target.value)}
						maxLength={80}
						className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
					/>
					<button
						type="submit"
						className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-950"
					>
						{messages.common.actions.save}
					</button>
				</form>
			) : null}
			{error ? <p className="mt-2 text-sm text-orange-200">{error}</p> : null}
		</div>
	);
}

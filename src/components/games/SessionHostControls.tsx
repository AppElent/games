import { MAX_TITLE_LENGTH } from "@arcadeclub/core/sessions";
import { Lock, LockOpen, Pencil } from "lucide-react";
import { useState } from "react";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import type { SessionModeration } from "./useSessionModeration";

/**
 * Host-only room controls: lock the room against new joiners and rename
 * the session. Render only when the local participant is the host.
 */
export function SessionHostControls({
	moderation,
	title,
	locked,
}: {
	moderation: SessionModeration;
	title: string;
	locked: boolean;
}) {
	const messages = useMessages();
	const [editing, setEditing] = useState(false);
	const [draftTitle, setDraftTitle] = useState(title);
	const { error, run } = useGameAction();

	return (
		<div className="club-panel rounded-lg p-4">
			<h2 className="mb-3 club-panel-heading">
				{messages.common.roomControls.heading}
			</h2>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					className="inline-flex items-center gap-2 rounded-md border border-[var(--club-line-strong)] bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
					onClick={() =>
						void run(
							() => moderation.setLocked(!locked),
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
					className="inline-flex items-center gap-2 rounded-md border border-[var(--club-line-strong)] bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
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
							() => moderation.rename(draftTitle),
							messages.common.roomControls.renameError,
						).then((renamed) => {
							if (renamed) {
								setEditing(false);
							}
						});
					}}
				>
					<input
						value={draftTitle}
						onChange={(event) => setDraftTitle(event.target.value)}
						maxLength={MAX_TITLE_LENGTH}
						className="min-w-0 flex-1 rounded-md border border-slate-400/60 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
					/>
					<button
						type="submit"
						className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-950"
					>
						{messages.common.actions.save}
					</button>
				</form>
			) : null}
			{error ? <p className="mt-2 club-error">{error}</p> : null}
		</div>
	);
}

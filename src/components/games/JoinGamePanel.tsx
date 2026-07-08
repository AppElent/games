import { useState } from "react";
import { normalizeJoinCode } from "#/lib/games/sessions";
import { useMessages } from "#/lib/i18n";

export function JoinGamePanel() {
	const messages = useMessages();
	const [code, setCode] = useState("");

	return (
		<form
			className="club-panel rounded-lg p-4"
			onSubmit={(event) => {
				event.preventDefault();
				const joinCode = normalizeJoinCode(code);
				if (joinCode) {
					window.location.href = `/join?code=${encodeURIComponent(joinCode)}`;
				}
			}}
		>
			<label
				className="mb-2 block text-sm font-bold text-[var(--club-text)]"
				htmlFor="join-code"
			>
				{messages.common.joinPanel.title}
			</label>
			<div className="flex gap-2">
				<input
					id="join-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder={messages.common.session.roomCode}
					className="min-w-0 flex-1 rounded-md border border-[var(--club-line)] bg-[var(--club-panel-strong)] px-3 py-2 text-sm text-[var(--club-text)] placeholder:text-[var(--club-soft)] outline-none focus:border-cyan-300"
				/>
				<button
					type="submit"
					className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200"
				>
					{messages.common.header.join}
				</button>
			</div>
		</form>
	);
}

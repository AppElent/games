import { buildInviteUrl, normalizeJoinCode } from "@arcadeclub/core/sessions";
import { useState } from "react";
import { useMessages } from "#/lib/i18n";

export function JoinGamePanel() {
	const messages = useMessages();
	const [code, setCode] = useState("");

	return (
		<form
			className="club-join-panel"
			onSubmit={(event) => {
				event.preventDefault();
				const joinCode = normalizeJoinCode(code);
				if (joinCode) {
					window.location.href = buildInviteUrl("", { code: joinCode });
				}
			}}
		>
			<h2 className="club-title text-xl font-bold">
				{messages.common.joinPanel.title}
			</h2>
			<p className="text-sm leading-5 text-[var(--club-muted)]">
				{messages.common.joinPanel.subtitle}
			</p>
			<label
				className="mb-2 block text-sm font-bold text-[var(--club-text)]"
				htmlFor="join-code"
			>
				{messages.common.session.roomCode}
			</label>
			<div className="flex flex-col gap-3">
				<input
					id="join-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder={messages.common.joinPanel.codePlaceholder}
					className="club-join-code"
				/>
				<button type="submit" className="club-join-submit">
					{messages.common.joinPanel.submit}
				</button>
			</div>
		</form>
	);
}

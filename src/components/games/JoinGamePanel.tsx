import { useState } from "react";
import { normalizeJoinCode } from "#/lib/games/sessions";

export function JoinGamePanel() {
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
				className="mb-2 block text-sm font-bold text-white"
				htmlFor="join-code"
			>
				Join a game
			</label>
			<div className="flex gap-2">
				<input
					id="join-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder="Room code"
					className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
				/>
				<button
					type="submit"
					className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200"
				>
					Join
				</button>
			</div>
		</form>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/signal-words/new")({
	component: SignalWordsNewPage,
	staticData: { fullscreen: true },
});

function SignalWordsNewPage() {
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.signalWords.createState);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function handleCreate() {
		setBusy(true);
		setError("");
		try {
			const guest = getOrCreateGuestIdentity();
			const result = await createSession({
				gameType: "signal-words",
				joinMode: "room",
				authPolicy: "guestAllowed",
				title: "Signal Words",
				displayName: guest.displayName,
				guestId: guest.id,
			});
			await createState({
				sessionId: result.sessionId,
				hostParticipantId: result.participantId,
			});
			window.sessionStorage.setItem(
				"arcade-club.participantId",
				result.participantId,
			);
			window.location.href = `/signal-words/${result.sessionId}`;
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not create room"));
			setBusy(false);
		}
	}

	return (
		<FullscreenGamePage title="Signal Words">
			<p className="club-kicker mb-2">Signal Words</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Host a room
			</h1>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<div className="club-panel max-w-xl rounded-lg p-6">
				<p className="mb-5 text-sm text-slate-300">
					Two teams race to find their signal words from one-word clues. 4+
					players — each team needs a clue-giver and at least one guesser.
					Everyone joins with the room code.
				</p>
				<button
					type="button"
					disabled={busy}
					onClick={handleCreate}
					className="min-h-11 w-full rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{busy ? "Creating room..." : "Create room"}
				</button>
			</div>
		</FullscreenGamePage>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/bluff-dice/new")({
	component: BluffDiceNewPage,
});

function BluffDiceNewPage() {
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.bluffDice.createState);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function handleCreate() {
		setBusy(true);
		setError("");
		try {
			const guest = getOrCreateGuestIdentity();
			const result = await createSession({
				gameType: "bluff-dice",
				joinMode: "room",
				authPolicy: "guestAllowed",
				title: "Bluff Dice",
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
			window.location.href = `/bluff-dice/${result.sessionId}`;
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not create room"));
			setBusy(false);
		}
	}

	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">Bluff Dice</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Host a table
			</h1>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<div className="club-panel max-w-xl rounded-lg p-6">
				<p className="mb-5 text-sm text-slate-300">
					Hidden dice, rising claims, and one big question: is anyone bluffing?
					2-8 players, everyone joins with the room code.
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
		</main>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate, useHostDisplayName } from "#/components/games/HostGate";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/bluff-dice/new")({
	component: BluffDiceNewPage,
	staticData: { fullscreen: true },
});

function BluffDiceNewPage() {
	const messages = useMessages();
	const bluffDice = messages.games.bluffDice;
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.bluffDice.createState);
	const hostName = useHostDisplayName();
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
				title: messages.catalog["bluff-dice"].title,
				displayName: hostName,
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
			setError(getUserErrorMessage(caught, bluffDice.new.couldNotCreateRoom));
			setBusy(false);
		}
	}

	return (
		<FullscreenGamePage title={messages.catalog["bluff-dice"].title}>
			<p className="club-kicker mb-2">{messages.catalog["bluff-dice"].title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{bluffDice.new.heading}
			</h1>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<HostGate>
				<div className="club-panel max-w-xl rounded-lg p-6">
					<p className="mb-5 text-sm text-slate-300">
						{bluffDice.new.description}
					</p>
					<button
						type="button"
						disabled={busy}
						onClick={handleCreate}
						className="min-h-11 w-full rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{busy
							? bluffDice.new.creatingRoomButton
							: bluffDice.new.createRoomButton}
					</button>
				</div>
			</HostGate>
		</FullscreenGamePage>
	);
}

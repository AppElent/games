import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/connect-four/new")({
	component: ConnectFourNewPage,
	staticData: { fullscreen: true },
});

function ConnectFourNewPage() {
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.connectFour.createState);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function handleCreate() {
		setBusy(true);
		setError("");
		try {
			const guest = getOrCreateGuestIdentity();
			const result = await createSession({
				gameType: "connect-four",
				joinMode: "challenge",
				authPolicy: "guestAllowed",
				title: "Connect Four",
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
			window.location.href = `/connect-four/${result.sessionId}`;
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not create challenge"));
			setBusy(false);
		}
	}

	return (
		<FullscreenGamePage title="Connect Four">
			<p className="club-kicker mb-2">Connect Four</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Start a game
			</h1>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<div className="club-panel max-w-xl rounded-lg p-6">
				<p className="mb-5 text-sm text-slate-300">
					You play red and move first. Share the link or QR code — your opponent
					claims the yellow seat automatically.
				</p>
				<button
					type="button"
					disabled={busy}
					onClick={handleCreate}
					className="min-h-11 w-full rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{busy ? "Creating challenge..." : "Create challenge link"}
				</button>
			</div>
		</FullscreenGamePage>
	);
}

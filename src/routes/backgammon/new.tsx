import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/backgammon/new")({
	component: BackgammonNewPage,
});

function BackgammonNewPage() {
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.backgammon.createState);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">Backgammon</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Start a challenge
			</h1>
			<p className="mb-6 max-w-2xl text-slate-300">
				Create a direct challenge link. The other player scans the QR code or
				opens the link and automatically claims the black seat.
			</p>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<button
				type="button"
				disabled={busy}
				className="rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
				onClick={async () => {
					setBusy(true);
					setError("");
					try {
						const guest = getOrCreateGuestIdentity();
						const result = await createSession({
							gameType: "backgammon",
							joinMode: "challenge",
							authPolicy: "guestAllowed",
							title: "Backgammon Match",
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
						window.location.href = `/backgammon/${result.sessionId}`;
					} catch (caught) {
						setError(
							caught instanceof Error
								? caught.message
								: "Could not create challenge",
						);
					} finally {
						setBusy(false);
					}
				}}
			>
				{busy ? "Creating challenge..." : "Create challenge link"}
			</button>
		</main>
	);
}

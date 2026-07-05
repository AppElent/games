import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate, useHostDisplayName } from "#/components/games/HostGate";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/backgammon/new")({
	component: BackgammonNewPage,
	staticData: { fullscreen: true },
});

function BackgammonNewPage() {
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.backgammon.createState);
	const hostName = useHostDisplayName();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	return (
		<FullscreenGamePage title="Backgammon">
			<p className="club-kicker mb-2">Backgammon</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Start a match
			</h1>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<div className="grid max-w-3xl gap-4 md:grid-cols-2">
				<div className="club-panel flex flex-col rounded-lg p-6">
					<h2 className="club-title text-2xl font-bold text-white">
						Local match
					</h2>
					<p className="mt-2 flex-1 text-sm text-slate-300">
						Two players on this device. Nothing leaves your browser — the game
						is saved locally so you can pick it up later.
					</p>
					<Link
						to="/backgammon/local"
						className="mt-5 rounded-md bg-white px-5 py-3 text-center font-bold text-slate-950"
					>
						Play on this device
					</Link>
				</div>
				<HostGate>
					<div className="club-panel flex flex-col rounded-lg p-6">
						<h2 className="club-title text-2xl font-bold text-white">
							Online challenge
						</h2>
						<p className="mt-2 flex-1 text-sm text-slate-300">
							Create a challenge link. The other player scans the QR code or
							opens the link and automatically claims the black seat.
						</p>
						<button
							type="button"
							disabled={busy}
							className="mt-5 rounded-md border border-white/20 bg-white/10 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
									window.location.href = `/backgammon/${result.sessionId}`;
								} catch (caught) {
									setError(
										getUserErrorMessage(caught, "Could not create challenge"),
									);
								} finally {
									setBusy(false);
								}
							}}
						>
							{busy ? "Creating challenge..." : "Create challenge link"}
						</button>
					</div>
				</HostGate>
			</div>
		</FullscreenGamePage>
	);
}

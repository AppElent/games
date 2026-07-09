import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate, useHostDisplayName } from "#/components/games/HostGate";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/backgammon/new")({
	component: BackgammonNewPage,
	staticData: { fullscreen: true },
});

function BackgammonNewPage() {
	const messages = useMessages();
	const backgammon = messages.games.backgammon;
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.backgammon.createState);
	const hostName = useHostDisplayName();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	return (
		<FullscreenGamePage title={messages.catalog.backgammon.title}>
			<p className="club-kicker mb-2">{messages.catalog.backgammon.title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{backgammon.newGame.heading}
			</h1>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<div className="grid max-w-3xl gap-4 md:grid-cols-2">
				<div className="club-panel flex flex-col rounded-lg p-6">
					<h2 className="club-title text-2xl font-bold text-white">
						{backgammon.newGame.localMatchHeading}
					</h2>
					<p className="mt-2 flex-1 text-sm text-slate-300">
						{backgammon.newGame.localMatchDescription}
					</p>
					<Link
						to="/backgammon/local"
						className="mt-5 rounded-md bg-white px-5 py-3 text-center font-bold text-slate-950"
					>
						{backgammon.newGame.playOnDevice}
					</Link>
				</div>
				<HostGate>
					<div className="club-panel flex flex-col rounded-lg p-6">
						<h2 className="club-title text-2xl font-bold text-white">
							{backgammon.newGame.onlineChallengeHeading}
						</h2>
						<p className="mt-2 flex-1 text-sm text-slate-300">
							{backgammon.newGame.onlineChallengeDescription}
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
										title: messages.catalog.backgammon.title,
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
										getUserErrorMessage(
											caught,
											backgammon.newGame.createChallengeError,
										),
									);
								} finally {
									setBusy(false);
								}
							}}
						>
							{busy
								? backgammon.newGame.creatingChallenge
								: backgammon.newGame.createChallengeLink}
						</button>
					</div>
				</HostGate>
			</div>
		</FullscreenGamePage>
	);
}

import { useMutation } from "convex/react";
import { useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

export function QuizSetupForm() {
	const createSession = useMutation(api.sessions.create);
	const ensureSampleSet = useMutation(api.quiz.ensureSampleSet);
	const startQuiz = useMutation(api.quiz.startForSession);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	return (
		<div className="club-panel max-w-xl rounded-lg p-5">
			<p className="mb-5 text-slate-300">
				Start with the built-in sample set, invite players with a code, and
				advance questions from the host screen.
			</p>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<button
				type="button"
				disabled={busy}
				className="rounded-md bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
				onClick={async () => {
					setBusy(true);
					setError("");
					try {
						const guest = getOrCreateGuestIdentity();
						const [quizSetId, result] = await Promise.all([
							ensureSampleSet(),
							createSession({
								gameType: "live-quiz",
								joinMode: "room",
								authPolicy: "hostChoice",
								title: "Live Quiz",
								displayName: guest.displayName,
								guestId: guest.id,
							}),
						]);
						await startQuiz({
							sessionId: result.sessionId,
							quizSetId,
						});
						window.sessionStorage.setItem(
							"arcade-club.hostParticipantId",
							result.participantId,
						);
						window.location.href = `/quiz/${result.sessionId}/host`;
					} catch (caught) {
						setError(getUserErrorMessage(caught, "Could not create quiz room"));
					} finally {
						setBusy(false);
					}
				}}
			>
				{busy ? "Creating room..." : "Create quiz room"}
			</button>
		</div>
	);
}

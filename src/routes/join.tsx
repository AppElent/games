import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import {
	getOrCreateGuestIdentity,
	normalizeJoinCode,
} from "#/lib/games/sessions";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/join")({
	validateSearch: (search) => ({
		code: typeof search.code === "string" ? search.code : "",
		token: typeof search.token === "string" ? search.token : "",
	}),
	component: JoinPage,
});

function JoinPage() {
	const search = Route.useSearch();
	const joinByCode = useMutation(api.sessions.joinByCode);
	const joinByToken = useMutation(api.sessions.joinByToken);
	const [code, setCode] = useState(search.code);
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const joiningByLink = Boolean(search.token);

	return (
		<main className="club-wrap flex min-h-[70vh] items-center justify-center py-10">
			<form
				className="club-panel w-full max-w-md rounded-lg p-6"
				onSubmit={async (event) => {
					event.preventDefault();
					setError("");
					const guest = getOrCreateGuestIdentity();
					try {
						const result = joiningByLink
							? await joinByToken({
									shareToken: search.token,
									displayName: name || guest.displayName,
									guestId: guest.id,
								})
							: await joinByCode({
									joinCode: normalizeJoinCode(code),
									displayName: name || guest.displayName,
									guestId: guest.id,
								});
						if (result.gameType === "live-quiz") {
							window.sessionStorage.setItem(
								"arcade-club.participantId",
								result.participantId,
							);
							window.location.href = `/quiz/${result.sessionId}/play?participantId=${result.participantId}`;
						}
						if (result.gameType === "hitster") {
							window.sessionStorage.setItem(
								"arcade-club.participantId",
								result.participantId,
							);
							window.location.href = `/hitster/${result.sessionId}/play?participantId=${result.participantId}`;
						}
						if (result.gameType === "backgammon") {
							window.sessionStorage.setItem(
								"arcade-club.participantId",
								result.participantId,
							);
							window.location.href = `/backgammon/${result.sessionId}`;
						}
					} catch (caught) {
						setError(getUserErrorMessage(caught, "Could not join game"));
					}
				}}
			>
				<p className="club-kicker mb-2">Join game</p>
				<h1 className="club-title mb-5 text-3xl font-bold text-white">
					{joiningByLink ? "Claim your seat" : "Enter your code"}
				</h1>
				<label
					className="mb-2 block text-sm font-bold text-slate-200"
					htmlFor="join-name"
				>
					Display name
				</label>
				<input
					id="join-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					className="mb-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
					placeholder="Player name"
				/>
				{joiningByLink ? (
					<div className="mb-4 rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-50">
						This invite link will add you to the game.
					</div>
				) : (
					<>
						<label
							className="mb-2 block text-sm font-bold text-slate-200"
							htmlFor="join-code"
						>
							Room code
						</label>
						<input
							id="join-code"
							value={code}
							onChange={(event) => setCode(event.target.value)}
							className="mb-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
							placeholder="ABC123"
						/>
					</>
				)}
				{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
				<button
					type="submit"
					className="w-full rounded-md bg-cyan-300 px-4 py-2.5 font-bold text-slate-950"
				>
					Join
				</button>
			</form>
		</main>
	);
}

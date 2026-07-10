import { useUser } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import {
	getOrCreateGuestIdentity,
	normalizeJoinCode,
} from "#/lib/games/sessions";
import { useMessages } from "#/lib/i18n";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/join")({
	validateSearch: (search): { code?: string; token?: string } => {
		const code = typeof search.code === "string" ? search.code : "";
		const token = typeof search.token === "string" ? search.token : "";
		// Omit empty keys so a bare visit to /join keeps a clean URL
		// (no trailing ?code=&token=).
		return {
			...(code ? { code } : {}),
			...(token ? { token } : {}),
		};
	},
	component: JoinPage,
});

function JoinPage() {
	const messages = useMessages();
	const search = Route.useSearch();
	const joinByCode = useMutation(api.sessions.joinByCode);
	const joinByToken = useMutation(api.sessions.joinByToken);
	const [code, setCode] = useState(search.code ?? "");
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [asSpectator, setAsSpectator] = useState(false);
	const joiningByLink = Boolean(search.token);

	// Signed-in players get their first name prefilled (still editable);
	// guests start with an empty field.
	const { user } = useUser();
	const prefilled = useRef(false);
	useEffect(() => {
		if (!prefilled.current && user?.firstName) {
			prefilled.current = true;
			setName((current) => current || user.firstName || "");
		}
	}, [user]);

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
									shareToken: search.token ?? "",
									displayName: name || guest.displayName,
									guestId: guest.id,
									asSpectator,
								})
							: await joinByCode({
									joinCode: normalizeJoinCode(code),
									displayName: name || guest.displayName,
									guestId: guest.id,
									asSpectator,
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
						if (result.gameType === "bluff-dice") {
							window.sessionStorage.setItem(
								"arcade-club.participantId",
								result.participantId,
							);
							window.location.href = `/bluff-dice/${result.sessionId}`;
						}
						if (result.gameType === "signal-words") {
							window.sessionStorage.setItem(
								"arcade-club.participantId",
								result.participantId,
							);
							window.location.href = `/signal-words/${result.sessionId}`;
						}
						if (result.gameType === "connect-four") {
							window.sessionStorage.setItem(
								"arcade-club.participantId",
								result.participantId,
							);
							window.location.href = `/connect-four/${result.sessionId}`;
						}
						if (result.gameType === "chess") {
							window.sessionStorage.setItem(
								"arcade-club.participantId",
								result.participantId,
							);
							window.location.href = `/chess/${result.sessionId}`;
						}
					} catch (caught) {
						setError(
							getUserErrorMessage(caught, messages.common.joinPanel.joinError),
						);
					}
				}}
			>
				<p className="club-kicker mb-2">{messages.common.joinPanel.kicker}</p>
				<h1 className="club-title mb-5 text-3xl font-bold text-[var(--club-text)]">
					{joiningByLink
						? messages.common.joinPanel.claimSeat
						: messages.common.joinPanel.enterCode}
				</h1>
				<label
					className="mb-2 block text-sm font-bold text-[var(--club-muted)]"
					htmlFor="join-name"
				>
					{messages.common.joinPanel.displayName}
				</label>
				<input
					id="join-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					className="mb-4 w-full rounded-md border border-[var(--club-line)] bg-[var(--club-panel-strong)] px-3 py-2 text-[var(--club-text)] placeholder:text-[var(--club-soft)]"
					placeholder={messages.common.joinPanel.playerNamePlaceholder}
				/>
				{joiningByLink ? (
					<div className="mb-4 rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-[var(--club-text)]">
						{messages.common.joinPanel.inviteNotice}
					</div>
				) : (
					<>
						<label
							className="mb-2 block text-sm font-bold text-[var(--club-muted)]"
							htmlFor="join-code"
						>
							{messages.common.session.roomCode}
						</label>
						<input
							id="join-code"
							value={code}
							onChange={(event) => setCode(event.target.value)}
							className="mb-4 w-full rounded-md border border-[var(--club-line)] bg-[var(--club-panel-strong)] px-3 py-2 text-[var(--club-text)] placeholder:text-[var(--club-soft)]"
							placeholder="ABC123"
						/>
					</>
				)}
				<label className="mb-4 flex items-center gap-2 text-sm text-[var(--club-muted)]">
					<input
						type="checkbox"
						checked={asSpectator}
						onChange={(event) => setAsSpectator(event.target.checked)}
						className="h-4 w-4 rounded border-[var(--club-line)]"
					/>
					{messages.common.session.spectating} only (watch, don't play)
				</label>
				{error ? (
					<p className="mb-4 text-sm text-[var(--club-orange)]">{error}</p>
				) : null}
				<button
					type="submit"
					className="w-full rounded-md bg-cyan-300 px-4 py-2.5 font-bold text-slate-950"
				>
					{messages.common.header.join}
				</button>
			</form>
		</main>
	);
}

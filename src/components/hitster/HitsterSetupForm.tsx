import { useMutation } from "convex/react";
import { useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import {
	getHitsterModeConfig,
	HITSTER_MODES,
	type HitsterMode,
} from "#/lib/games/hitster";
import {
	getPlayableHitsterCards,
	listHitsterPacks,
} from "#/lib/games/hitsterPacks";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

const TIMER_OPTIONS = [
	{ value: 0, label: "No timer" },
	{ value: 30, label: "30 seconds" },
	{ value: 60, label: "60 seconds" },
	{ value: 90, label: "90 seconds" },
];

export function HitsterSetupForm() {
	const createSession = useMutation(api.sessions.create);
	const setup = useMutation(api.hitster.setup);
	const [mode, setMode] = useState<HitsterMode>("original");
	const [packId, setPackId] = useState("normal");
	const [targetCards, setTargetCards] = useState(10);
	const [timer, setTimer] = useState(0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const packs = listHitsterPacks();
	const playableCount = getPlayableHitsterCards(packId, "hostDevice").length;
	const selectClass =
		"mt-1 w-full rounded-xl border border-[var(--club-line)] bg-[var(--club-panel-strong)] px-3 py-2.5 text-[var(--club-text)] focus-visible:outline-2 focus-visible:outline-blue-400";

	return (
		<div className="max-w-2xl space-y-5 rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-6">
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block text-sm font-semibold text-[var(--club-muted)]">
					Game mode
					<select
						className={selectClass}
						value={mode}
						onChange={(event) => setMode(event.target.value as HitsterMode)}
					>
						{HITSTER_MODES.map((entry) => (
							<option key={entry} value={entry}>
								{getHitsterModeConfig(entry).label}
							</option>
						))}
					</select>
				</label>
				<label className="block text-sm font-semibold text-[var(--club-muted)]">
					Song pack
					<select
						className={selectClass}
						value={packId}
						onChange={(event) => setPackId(event.target.value)}
					>
						{packs.map((pack) => (
							<option key={pack.id} value={pack.id}>
								{pack.title} ({pack.cards.length} tracks)
							</option>
						))}
					</select>
				</label>
				<label className="block text-sm font-semibold text-[var(--club-muted)]">
					Cards to win
					<select
						className={selectClass}
						value={targetCards}
						onChange={(event) => setTargetCards(Number(event.target.value))}
					>
						{[5, 8, 10, 12, 15].map((value) => (
							<option key={value} value={value}>
								{value} cards
							</option>
						))}
					</select>
				</label>
				<label className="block text-sm font-semibold text-[var(--club-muted)]">
					Turn timer
					<select
						className={selectClass}
						value={timer}
						onChange={(event) => setTimer(Number(event.target.value))}
					>
						{TIMER_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
			</div>

			<div className="rounded-2xl border border-[var(--club-line)] bg-[var(--club-panel-strong)] p-4 text-sm text-[var(--club-muted)]">
				<p className="font-semibold text-[var(--club-text)]">
					{getHitsterModeConfig(mode).label}
				</p>
				<p className="mt-1">{getHitsterModeConfig(mode).summary}</p>
				<p className="mt-2 text-[var(--club-soft)]">
					{playableCount} playable tracks with host-device playback. The host
					plays each mystery track on their own speaker (for example via
					Spotify) — this prototype does not stream audio itself.
				</p>
			</div>

			{error ? <p className="text-sm text-orange-300">{error}</p> : null}
			<button
				type="button"
				disabled={busy}
				className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-[#fff] disabled:cursor-not-allowed disabled:opacity-50"
				onClick={async () => {
					setBusy(true);
					setError("");
					try {
						const guest = getOrCreateGuestIdentity();
						const result = await createSession({
							gameType: "hitster",
							joinMode: "room",
							authPolicy: "hostChoice",
							title: "Music Timeline",
							displayName: guest.displayName,
							guestId: guest.id,
						});
						await setup({
							sessionId: result.sessionId,
							participantId: result.participantId,
							mode,
							packId,
							targetCards,
							turnTimerSeconds: timer > 0 ? timer : undefined,
							playbackMode: "hostDevice",
						});
						window.sessionStorage.setItem(
							"arcade-club.hostParticipantId",
							result.participantId,
						);
						window.location.href = `/hitster/${result.sessionId}/host`;
					} catch (caught) {
						setError(getUserErrorMessage(caught, "Could not create the room"));
					} finally {
						setBusy(false);
					}
				}}
			>
				{busy ? "Creating room..." : "Create music room"}
			</button>
		</div>
	);
}

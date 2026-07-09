import { useMutation } from "convex/react";
import { useState } from "react";
import { HostGate, useHostDisplayName } from "#/components/games/HostGate";
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
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

const TIMER_VALUES = [0, 30, 60, 90];
const TARGET_CARDS_OPTIONS = [5, 8, 10, 12, 15];

export function HitsterSetupForm() {
	return (
		<HostGate>
			<HitsterSetupFormInner />
		</HostGate>
	);
}

function HitsterSetupFormInner() {
	const { locale, messages } = useI18n();
	const setupForm = messages.games.hitster.setupForm;
	const createSession = useMutation(api.sessions.create);
	const hostName = useHostDisplayName();
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
					{setupForm.gameModeLabel}
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
					{setupForm.songPackLabel}
					<select
						className={selectClass}
						value={packId}
						onChange={(event) => setPackId(event.target.value)}
					>
						{packs.map((pack) => (
							<option key={pack.id} value={pack.id}>
								{fmt(plural(locale, pack.cards.length, setupForm.packOption), {
									packTitle: pack.title,
								})}
							</option>
						))}
					</select>
				</label>
				<label className="block text-sm font-semibold text-[var(--club-muted)]">
					{setupForm.cardsToWinLabel}
					<select
						className={selectClass}
						value={targetCards}
						onChange={(event) => setTargetCards(Number(event.target.value))}
					>
						{TARGET_CARDS_OPTIONS.map((value) => (
							<option key={value} value={value}>
								{fmt(setupForm.cardsOption, { count: value })}
							</option>
						))}
					</select>
				</label>
				<label className="block text-sm font-semibold text-[var(--club-muted)]">
					{setupForm.turnTimerLabel}
					<select
						className={selectClass}
						value={timer}
						onChange={(event) => setTimer(Number(event.target.value))}
					>
						{TIMER_VALUES.map((value) => (
							<option key={value} value={value}>
								{value === 0
									? setupForm.noTimer
									: fmt(setupForm.timerSecondsOption, { count: value })}
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
					{plural(locale, playableCount, setupForm.playableTracksInfo)}
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
							title: messages.games.hitster.musicTimelineKicker,
							displayName: hostName,
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
						setError(getUserErrorMessage(caught, setupForm.createRoomError));
					} finally {
						setBusy(false);
					}
				}}
			>
				{busy ? setupForm.creatingRoom : setupForm.createRoom}
			</button>
		</div>
	);
}

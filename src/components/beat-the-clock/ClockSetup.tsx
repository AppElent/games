/**
 * Beat the Clock's room settings: word pack, time per turn, points to win
 * and teams, then Host room. Cards use the host's app language.
 */
import {
	CLOCK_DEFAULTS,
	CLOCK_TARGETS,
	CLOCK_TEAM_COUNTS,
	CLOCK_TURN_SECONDS,
} from "@arcadeclub/core/beat-the-clock";
import {
	CLOCK_PACK_IDS,
	type ClockPackId,
	clockPackCards,
} from "@arcadeclub/core/beat-the-clock-packs";
import { fmt, plural } from "@arcadeclub/core/i18n/format";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { useHostSession } from "#/lib/games/use-host-session";
import { useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { ErrorNotice, PrimaryButton, useClockCopy } from "./ClockBits";

export function ClockSetup() {
	const copy = useClockCopy();
	const { locale, messages } = useI18n();
	const create = useMutation(api.beatTheClock.create);
	const { busy, error, host } = useHostSession("beat-the-clock");
	const [packId, setPackId] = useState<ClockPackId>("everyday");
	const [turnSeconds, setTurnSeconds] = useState<number>(
		CLOCK_DEFAULTS.turnSeconds,
	);
	const [target, setTarget] = useState<number>(CLOCK_DEFAULTS.target);
	const [teamCount, setTeamCount] = useState<number>(CLOCK_DEFAULTS.teamCount);

	const back = (
		<Link
			to="/"
			aria-label={messages.common.gameShell.returnToGames}
			className="flex h-11 w-11 items-center justify-center rounded-full club-btn-outline bg-[var(--club-surface)] text-[var(--club-text)]"
		>
			<ArrowLeft aria-hidden="true" className="h-5 w-5" />
		</Link>
	);

	return (
		<FullscreenGamePage
			title={copy.title}
			maxWidthClassName="max-w-[480px]"
			menu={back}
		>
			<div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-5">
				<header className="flex items-center gap-3">
					{back}
					<div>
						<p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--club-amber)]">
							{copy.title}
						</p>
						<h1 className="club-title text-[26px] font-bold text-[var(--club-text)]">
							{copy.settings.heading}
						</h1>
					</div>
				</header>
				<HostGate>
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--club-muted)]">
							{copy.settings.pack}
						</legend>
						<div className="overflow-hidden rounded-[18px] border border-[var(--club-line)] bg-[var(--club-surface)]">
							{CLOCK_PACK_IDS.map((id) => {
								const selected = id === packId;
								return (
									<label
										key={id}
										className={`flex min-h-14 w-full cursor-pointer items-center gap-3 border-b border-[var(--club-line)] px-4 text-left last:border-b-0 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--club-cyan)] ${selected ? "bg-[var(--club-accent-dim)]" : ""}`}
									>
										<input
											type="radio"
											name="clock-pack"
											value={id}
											checked={selected}
											onChange={() => setPackId(id)}
											className="sr-only"
										/>
										<span
											className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-[var(--club-cyan)]" : "border-[var(--club-line-strong)]"}`}
										>
											{selected ? (
												<span className="h-2.5 w-2.5 rounded-full bg-[var(--club-cyan)]" />
											) : null}
										</span>
										<span className="flex-1 font-semibold text-[var(--club-text)]">
											{copy.settings.packs[id]}
										</span>
										<span className="text-sm text-[var(--club-muted)]">
											{plural(
												locale,
												clockPackCards(id, locale),
												copy.settings.cards,
											)}
										</span>
									</label>
								);
							})}
						</div>
					</fieldset>
					<Segmented
						label={copy.settings.timer}
						options={CLOCK_TURN_SECONDS}
						value={turnSeconds}
						onChange={setTurnSeconds}
						format={(n) => fmt(copy.settings.seconds, { n })}
					/>
					<Segmented
						label={copy.settings.target}
						options={CLOCK_TARGETS}
						value={target}
						onChange={setTarget}
					/>
					<Segmented
						label={copy.settings.teams}
						options={CLOCK_TEAM_COUNTS}
						value={teamCount}
						onChange={setTeamCount}
					/>
					<p className="text-sm text-[var(--club-muted)]">
						{copy.settings.note}
					</p>
					<div className="mt-auto flex flex-col gap-3">
						<ErrorNotice message={error} />
						<PrimaryButton
							busy={busy}
							busyLabel={copy.settings.creating}
							onClick={() =>
								host(
									({ displayName, guestId }) =>
										create({
											title: copy.title,
											displayName,
											guestId,
											packId,
											locale,
											turnSeconds,
											target,
											teamCount,
										}),
									copy.settings.createError,
								)
							}
						>
							{error ? copy.settings.retry : copy.settings.create}
						</PrimaryButton>
					</div>
				</HostGate>
			</div>
		</FullscreenGamePage>
	);
}

function Segmented({
	label,
	options,
	value,
	onChange,
	format = String,
}: {
	label: string;
	options: readonly number[];
	value: number;
	onChange: (value: number) => void;
	format?: (value: number) => string;
}) {
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--club-muted)]">
				{label}
			</legend>
			<div
				className="grid rounded-full bg-[var(--club-panel-strong)] p-0.5"
				style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
			>
				{options.map((option) => (
					<button
						key={option}
						type="button"
						aria-pressed={option === value}
						onClick={() => onChange(option)}
						className={`min-h-11 rounded-full text-sm font-bold ${option === value ? "bg-[var(--club-cyan)] text-[var(--club-on-accent)]" : "text-[var(--club-text)]"}`}
					>
						{format(option)}
					</button>
				))}
			</div>
		</fieldset>
	);
}

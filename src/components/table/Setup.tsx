import { Minus, Plus } from "lucide-react";
import type { TableMode } from "#/lib/games/use-create-table";

type SetupWords = {
	modeLabel: string;
	vsComputer: string;
	vsComputerHint: string;
	withFriends: string;
	withFriendsHint: string;
	opponentsLabel: string;
	fewerOpponents: string;
	moreOpponents: string;
};

/** Computer or friends: the first choice when opening any table game. */
export function ModePicker({
	mode,
	onChange,
	words,
}: {
	mode: TableMode;
	onChange: (mode: TableMode) => void;
	words: SetupWords;
}) {
	return (
		<fieldset>
			<legend className="cards-kicker mb-2">{words.modeLabel}</legend>
			<div className="grid grid-cols-2 gap-2">
				{(
					[
						["computer", words.vsComputer, words.vsComputerHint],
						["friends", words.withFriends, words.withFriendsHint],
					] as const
				).map(([value, label, hint]) => (
					<label key={value} className="mode-option">
						<input
							type="radio"
							name="mode"
							value={value}
							checked={mode === value}
							onChange={() => onChange(value)}
							className="sr-only"
						/>
						<span className="block font-bold">{label}</span>
						<span className="mt-0.5 block text-xs leading-snug text-[var(--ivory-muted)]">
							{hint}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

/** How many computer players join a game against the computer. */
export function OpponentStepper({
	value,
	min,
	max,
	label,
	onChange,
	words,
}: {
	value: number;
	min: number;
	max: number;
	/** The count in words, such as "3 opponents". */
	label: string;
	onChange: (value: number) => void;
	words: SetupWords;
}) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<span className="cards-kicker">{words.opponentsLabel}</span>
			<div className="flex items-center justify-between gap-2 sm:justify-start">
				<button
					type="button"
					className="stepper-btn"
					aria-label={words.fewerOpponents}
					disabled={value <= min}
					onClick={() => onChange(value - 1)}
				>
					<Minus className="h-4 w-4" />
				</button>
				<output
					aria-live="polite"
					className="min-w-[9rem] text-center font-bold whitespace-nowrap"
				>
					{label}
				</output>
				<button
					type="button"
					className="stepper-btn"
					aria-label={words.moreOpponents}
					disabled={value >= max}
					onClick={() => onChange(value + 1)}
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

/** A game's house rules as switches, each off until chosen. */
export function HouseRuleSwitches({
	heading,
	rules,
	chosen,
	onToggle,
}: {
	heading: string;
	rules: ReadonlyArray<{ id: string; label: string; hint: string }>;
	chosen: readonly string[];
	onToggle: (id: string) => void;
}) {
	if (rules.length === 0) {
		return null;
	}
	return (
		<div>
			<h2 className="cards-kicker mb-1">{heading}</h2>
			<div className="divide-y divide-white/10">
				{rules.map((rule) => (
					<button
						key={rule.id}
						type="button"
						role="switch"
						aria-checked={chosen.includes(rule.id)}
						className="rule-switch"
						onClick={() => onToggle(rule.id)}
					>
						<span className="min-w-0">
							<span className="block font-semibold">{rule.label}</span>
							<span className="block text-xs leading-snug text-[var(--ivory-muted)]">
								{rule.hint}
							</span>
						</span>
						<span className="rule-switch-track" aria-hidden="true" />
					</button>
				))}
			</div>
		</div>
	);
}

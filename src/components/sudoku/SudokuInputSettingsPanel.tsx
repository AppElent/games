import {
	CORNER_NOTE_LAYOUTS,
	SUDOKU_CYCLE_MODES,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { ChevronDown } from "lucide-react";
import { useMessages } from "#/lib/i18n";

type Props = {
	settings: SudokuInputSettings;
	onChange: (settings: SudokuInputSettings) => void;
};

/** Which modes a second tap cycles through, and where corner notes sit. */
export function SudokuInputSettingsPanel({ settings, onChange }: Props) {
	const copy = useMessages().games.sudoku.inputSettings;
	return (
		<details className="group w-full rounded-md border border-[var(--club-line)] text-xs text-slate-300">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 font-semibold hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 [&::-webkit-details-marker]:hidden">
				{copy.title}
				<ChevronDown
					aria-hidden="true"
					className="h-4 w-4 transition group-open:rotate-180"
				/>
			</summary>
			<div className="flex flex-col gap-3 px-3 pb-3">
				<fieldset className="flex flex-col gap-1.5">
					<legend className="mb-1.5 text-slate-400">
						{copy.tapCycleLabel}
					</legend>
					{SUDOKU_CYCLE_MODES.map((mode) => (
						<label
							key={mode}
							className="inline-flex cursor-pointer items-center gap-2"
						>
							<input
								type="checkbox"
								checked={settings.tapCycle[mode]}
								onChange={(event) =>
									onChange({
										...settings,
										tapCycle: {
											...settings.tapCycle,
											[mode]: event.target.checked,
										},
									})
								}
								className="accent-sky-400"
							/>
							{copy.modes[mode]}
						</label>
					))}
					<p className="text-slate-400">{copy.tapCycleNote}</p>
				</fieldset>
				<fieldset className="flex flex-col gap-1.5">
					<legend className="mb-1.5 text-slate-400">
						{copy.cornerLayoutLabel}
					</legend>
					{CORNER_NOTE_LAYOUTS.map((layout) => (
						<label
							key={layout}
							className="inline-flex cursor-pointer items-center gap-2"
						>
							<input
								type="radio"
								name="sudoku-corner-layout"
								checked={settings.cornerLayout === layout}
								onChange={() => onChange({ ...settings, cornerLayout: layout })}
								className="accent-sky-400"
							/>
							{copy.cornerLayouts[layout]}
						</label>
					))}
				</fieldset>
			</div>
		</details>
	);
}

import { useUser } from "@clerk/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthConfig } from "#/lib/auth/components/auth/AuthConfigProvider";
import {
	applyThemeMode,
	getInitialMode,
	setThemeMode,
	type ThemeMode,
} from "#/lib/auth/lib/theme";
import { cn } from "#/lib/auth/lib/utils";
import { fmt, useMessages } from "#/lib/i18n";

const OPTIONS: {
	mode: ThemeMode;
	label: "light" | "system" | "dark";
	icon: typeof Sun;
}[] = [
	{ mode: "light", label: "light", icon: Sun },
	{ mode: "auto", label: "system", icon: Monitor },
	{ mode: "dark", label: "dark", icon: Moon },
];

export function AppearanceSettings() {
	const { appName } = useAuthConfig();
	const copy = useMessages().profile;
	const [mode, setMode] = useState<ThemeMode>("auto");
	const { user } = useUser();

	useEffect(() => {
		setMode(getInitialMode());
	}, []);

	useEffect(() => {
		if (mode !== "auto") {
			return;
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyThemeMode("auto");

		media.addEventListener("change", onChange);
		return () => {
			media.removeEventListener("change", onChange);
		};
	}, [mode]);

	function selectMode(next: ThemeMode) {
		setMode(next);
		setThemeMode(next);
		if (user) {
			user
				.update({ unsafeMetadata: { ...user.unsafeMetadata, theme: next } })
				.catch(() => {
					// non-fatal: local theme already applied
				});
		}
	}

	return (
		<section className="rm-panel p-4">
			<p className="rm-label">{copy.appearance}</p>
			<p className="mt-1 text-sm text-neutral-500">
				{fmt(copy.appearanceBody, { appName })}
			</p>
			<div className="mt-3 inline-flex gap-1 rounded-md border border-neutral-200 p-1">
				{OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => (
					<button
						key={optionMode}
						type="button"
						onClick={() => selectMode(optionMode)}
						aria-pressed={mode === optionMode}
						className={cn(
							"flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition",
							mode === optionMode
								? "bg-neutral-900 text-white"
								: "text-neutral-600 hover:bg-neutral-100",
						)}
					>
						<Icon size={15} /> {copy.appearanceOptions[label]}
					</button>
				))}
			</div>
		</section>
	);
}

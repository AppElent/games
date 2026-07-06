import {
	applyThemeMode,
	getInitialMode,
	setThemeMode,
	type ThemeMode,
} from "@appelent/auth";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
	const [mode, setMode] = useState<ThemeMode>("auto");

	useEffect(() => {
		const initialMode = getInitialMode();
		setMode(initialMode);
		applyThemeMode(initialMode);
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

	function toggleMode() {
		const nextMode: ThemeMode =
			mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
		setMode(nextMode);
		setThemeMode(nextMode);
	}

	// Matches the cycle in toggleMode: light -> dark -> auto -> light.
	const label =
		mode === "light"
			? "Theme mode: light. Click to switch to dark mode."
			: mode === "dark"
				? "Theme mode: dark. Click to switch to auto (system) mode."
				: "Theme mode: auto (system). Click to switch to light mode.";

	return (
		<button
			type="button"
			onClick={toggleMode}
			aria-label={label}
			title={label}
			className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
		>
			{mode === "auto" ? "Auto" : mode === "dark" ? "Dark" : "Light"}
		</button>
	);
}

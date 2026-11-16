import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
	applyThemeMode,
	getInitialMode,
	setThemeMode,
	type ThemeMode,
} from "#/lib/auth";

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
			className="club-header-button"
		>
			{mode === "auto" ? (
				<Monitor size={18} />
			) : mode === "dark" ? (
				<Moon size={18} />
			) : (
				<Sun size={18} />
			)}
		</button>
	);
}

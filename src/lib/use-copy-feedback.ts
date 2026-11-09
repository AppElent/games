import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_MS = 2000;

/** Copies `text`; false when the clipboard is missing or refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * A copy button's state: `copied` turns on for 2 s after a copy that worked,
 * and never after one that failed. The timer dies with the component.
 */
export function useCopyFeedback() {
	const [copied, setCopied] = useState(false);
	const timer = useRef<number | undefined>(undefined);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const copy = useCallback(async (text: string) => {
		const succeeded = await copyToClipboard(text);
		if (succeeded) {
			window.clearTimeout(timer.current);
			setCopied(true);
			timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
		}
		return succeeded;
	}, []);

	return { copied, copy };
}

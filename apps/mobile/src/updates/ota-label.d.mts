// Types for ota-label.mjs, a byte copy of developer-home's
// standards/releases/ota-label.mjs (keep that file unchanged).
export const OTA_LABEL_MONTHS: string[];
export function formatOtaLabel(
	version: string,
	publishedAt: Date | string | number,
	sha: string,
): string;

/**
 * The About line: `Versie <version> (<build>) · update <label> · <channel>`,
 * or `geen update` in place of the update part on the embedded bundle
 * (developer-home standards/releases.md, "OTA label"). Pure, so a test can run
 * it without expo-updates.
 */
import { formatOtaLabel } from "./ota-label.mjs";

export interface BuildInfoInput {
	version: string;
	/** The native build number; unknown (dev client, Android) leaves it out. */
	build: string | null | undefined;
	channel: string | null | undefined;
	/**
	 * The running OTA update's publish time, or `null` when the embedded bundle
	 * runs (no update downloaded, or updates are off).
	 */
	updateCreatedAt: Date | null | undefined;
	/** The commit the update was published from, inlined into its bundle. */
	sha: string | undefined;
}

export interface BuildInfoCopy {
	/** `{version}` and `{build}`, e.g. `Versie 1.0.0 (23)`. */
	version: string;
	versionWithBuild: string;
	/** `{label}`, e.g. `update 1.0.0 · 20 nov · a1b2c3d`. */
	update: string;
	noUpdate: string;
}

function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

/** The OTA label, or `null` when no update runs or its commit is unknown. */
export function otaLabel(input: BuildInfoInput): string | null {
	if (!input.updateCreatedAt || !input.sha) return null;
	try {
		return formatOtaLabel(input.version, input.updateCreatedAt, input.sha);
	} catch {
		return null;
	}
}

export function buildInfoLine(
	input: BuildInfoInput,
	copy: BuildInfoCopy,
): string {
	const label = otaLabel(input);
	const version = input.build
		? fill(copy.versionWithBuild, {
				version: input.version,
				build: input.build,
			})
		: fill(copy.version, { version: input.version });
	return [
		version,
		label ? fill(copy.update, { label }) : copy.noUpdate,
		input.channel,
	]
		.filter(Boolean)
		.join(" · ");
}

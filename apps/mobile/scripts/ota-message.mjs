// The EAS update message of an OTA publish is its OTA label
// (developer-home standards/releases.md, "OTA label"):
// `<version> · <d mmm> · <short sha>`. The format lives in
// ../src/updates/ota-label.mjs, a copy of developer-home's definition.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatOtaLabel } from "../src/updates/ota-label.mjs";

/**
 * The label for publishing `commit` now, with the version `appDir`'s
 * `app.json` (a checkout of that commit) declares.
 */
export function otaMessage(appDir, commit, now = new Date()) {
	const { expo } = JSON.parse(readFileSync(join(appDir, "app.json"), "utf8"));
	return formatOtaLabel(expo.version, now, commit);
}

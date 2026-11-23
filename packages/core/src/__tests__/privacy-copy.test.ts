import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { nl } from "../i18n/nl";

describe.each([
	["en", en],
	["nl", nl],
] as const)("privacy policy (%s)", (_locale, messages) => {
	const rights = messages.privacy.sections.rights.paragraphs;

	it("points to the self-service download by its button label", () => {
		expect(rights.download).toContain(messages.profile.exportData.action);
	});

	it("keeps email as the fallback for a copy", () => {
		expect(rights.gdpr).toContain("privacy@appelent.nl");
	});
});

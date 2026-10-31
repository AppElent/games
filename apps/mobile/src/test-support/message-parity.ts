// Copied from developer-tools `i18n/examples/test-utils.ts`; Jest supplies
// `describe`/`expect`/`it` as globals here instead of importing Vitest, and Jest
// has no assertion-message argument, so each assertion carries its label in
// the compared value.

type Tree = { [key: string]: string | Tree };

function collectLeaves(tree: Tree, prefix: string, out: Map<string, string>) {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			out.set(path, value);
		} else {
			collectLeaves(value, path, out);
		}
	}
}

function placeholders(message: string): string[] {
	return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/**
 * Registers a `describe("message dictionaries", ...)` block that asserts
 * every locale's message tree has identical key sets, no empty strings, and
 * identical `{placeholder}` tokens per message pair — the load-bearing
 * correctness check for a `satisfies`-based typed dictionary. Call this once
 * per app from its own `messages.test.ts`, passing every locale's tree.
 */
export function assertMessageParity(locales: Record<string, Tree>): void {
	const localeNames = Object.keys(locales);
	const leavesByLocale = new Map<string, Map<string, string>>();
	for (const [name, tree] of Object.entries(locales)) {
		const leaves = new Map<string, string>();
		collectLeaves(tree, "", leaves);
		leavesByLocale.set(name, leaves);
	}
	const [firstLocale, ...restLocales] = localeNames;

	describe("message dictionaries", () => {
		it("have identical key sets", () => {
			if (!firstLocale) {
				return;
			}
			const firstKeys = [
				...(leavesByLocale.get(firstLocale) as Map<string, string>).keys(),
			].sort();
			for (const locale of restLocales) {
				const keys = [
					...(leavesByLocale.get(locale) as Map<string, string>).keys(),
				].sort();
				expect({ locale, keys }).toEqual({ locale, keys: firstKeys });
			}
		});

		it("have no empty messages", () => {
			for (const [locale, leaves] of leavesByLocale) {
				for (const [path, value] of leaves) {
					expect({
						at: `${locale}: ${path}`,
						empty: value.trim() === "",
					}).toEqual({
						at: `${locale}: ${path}`,
						empty: false,
					});
				}
			}
		});

		it("use the same placeholders per message", () => {
			if (!firstLocale) {
				return;
			}
			const firstLeaves = leavesByLocale.get(firstLocale) as Map<
				string,
				string
			>;
			for (const locale of restLocales) {
				const leaves = leavesByLocale.get(locale) as Map<string, string>;
				for (const [path, firstValue] of firstLeaves) {
					const value = leaves.get(path);
					const at = `${locale}: ${path}`;
					expect({ at, placeholders: placeholders(value ?? "") }).toEqual({
						at,
						placeholders: placeholders(firstValue),
					});
				}
			}
		});
	});
}

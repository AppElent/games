/**
 * The resolved `app.config.ts` per variant against the link config: only
 * production and preview claim the host, each claiming build is in the
 * AASA's app IDs, and every scheme is one `systemPath` recognises.
 */
import type { ExpoConfig } from "expo/config";
import appConfig from "../../app.config";
import { APP_LINK_APP_IDS, APP_LINK_HOST, APP_LINK_SCHEMES } from "./app-links";

function resolve(variant: string): ExpoConfig {
	const previous = process.env.APP_VARIANT;
	process.env.APP_VARIANT = variant;
	try {
		return appConfig({ config: {} } as Parameters<typeof appConfig>[0]);
	} finally {
		if (previous === undefined) delete process.env.APP_VARIANT;
		else process.env.APP_VARIANT = previous;
	}
}

describe("app config links", () => {
	it.each(["production", "preview"])("%s claims the web host", (variant) => {
		const { ios } = resolve(variant);
		expect(ios?.associatedDomains).toEqual([
			`applinks:${APP_LINK_HOST}`,
			`webcredentials:${APP_LINK_HOST}`,
		]);
		expect(APP_LINK_APP_IDS).toContain(
			`${ios?.appleTeamId}.${ios?.bundleIdentifier}`,
		);
	});

	it("development claims nothing", () => {
		expect(resolve("development").ios?.associatedDomains).toEqual([]);
	});

	it("lists Preview first, as iOS follows the AASA in order", () => {
		const id = (variant: string) => {
			const { ios } = resolve(variant);
			return `${ios?.appleTeamId}.${ios?.bundleIdentifier}`;
		};
		expect(APP_LINK_APP_IDS).toEqual([id("preview"), id("production")]);
	});

	it("knows every variant's scheme", () => {
		const schemes = ["production", "preview", "development"].map(
			(variant) => resolve(variant).scheme,
		);
		expect(schemes).toEqual([...APP_LINK_SCHEMES]);
	});

	it("claims no Android links yet", () => {
		for (const variant of ["production", "preview", "development"]) {
			expect(resolve(variant).android?.intentFilters).toBeUndefined();
		}
	});
});

/**
 * Every incoming link passes here before Expo Router matches it. A claimed
 * web link (`https://arcade-club.appelent.nl/join?token=…`) or its scheme
 * form opens the join tab with only the valid keys; any other web link
 * opens home; other scheme links pass through. See `src/lib/app-links.ts`.
 */
import { appLinks } from "../src/lib/app-links";

export function redirectSystemPath({
	path,
}: {
	path: string;
	initial: boolean;
}) {
	return appLinks.systemPath(path);
}

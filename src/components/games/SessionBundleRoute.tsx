import type { ReactNode } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { MatchStatus } from "#/components/games/match/MatchStage";

type BundleStatus = "loading" | "notFound";

/** How a game screen shows a status line while it has no bundle to render. */
type StatusShell = (text: string, status: BundleStatus) => ReactNode;

/**
 * A session screen's three states: loading (`undefined`), gone (`null`), and
 * the game itself.
 */
export function SessionBundleRoute<Bundle>({
	bundle,
	shell,
	loading,
	notFound,
	children,
}: {
	bundle: Bundle | null | undefined;
	shell: StatusShell;
	loading: string;
	notFound: string;
	children: (bundle: Bundle) => ReactNode;
}) {
	if (bundle === undefined) {
		return shell(loading, "loading");
	}
	if (bundle === null) {
		return shell(notFound, "notFound");
	}
	return children(bundle);
}

/** The status line centered in a full-screen board shell. */
export function boardShell(title: string): StatusShell {
	return (text, status) => (
		<MatchStatus title={title} text={text} notFound={status === "notFound"} />
	);
}

/** The status line as the text of a game page. */
export function pageShell(
	title: string,
	classNames: Record<BundleStatus, string> = {
		loading: "text-slate-300",
		notFound: "text-orange-200",
	},
): StatusShell {
	return (text, status) => (
		<FullscreenGamePage title={title} className={classNames[status]}>
			{text}
		</FullscreenGamePage>
	);
}

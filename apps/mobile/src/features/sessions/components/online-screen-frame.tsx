/**
 * An online game screen's title, with the shared loading state and the
 * centred message shown instead of the game when it can't be played here.
 */
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useI18n } from "../../../i18n";
import { CenteredState } from "../../../ui/centered-state";

export function OnlineScreenFrame({
	title,
	loading = false,
	blocked = null,
	children = null,
}: {
	title: string;
	loading?: boolean;
	/** Why the game isn't shown, such as an unavailable session. */
	blocked?: string | null;
	children?: ReactNode;
}) {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title }} />
			{loading ? (
				<CenteredState loading message={t.common.errors.loading} />
			) : blocked ? (
				<CenteredState title={blocked} />
			) : (
				children
			)}
		</>
	);
}

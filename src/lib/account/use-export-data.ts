import {
	accountExportFileName,
	buildAccountExport,
	serializeAccountExport,
} from "@arcadeclub/core/account-export";
import { useConvex, useConvexAuth } from "convex/react";
import { useState } from "react";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

/** Hands the browser a file to save, without opening a new tab. */
function saveFile(name: string, text: string) {
	const url = URL.createObjectURL(
		new Blob([text], { type: "application/json" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	// Older Safari follows only a link that is in the document.
	document.body.appendChild(link);
	link.click();
	link.remove();
	// Some browsers read the blob after `click` returns.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * "Download my data" on the Account page, the same steps as the app's
 * Profile (`@arcadeclub/core/account-export`): every page of
 * `account.exportMyData`, saved as `arcade-club-export-YYYY-MM-DD.json`.
 */
export function useExportData() {
	const convex = useConvex();
	const { isAuthenticated } = useConvexAuth();
	const copy = useMessages().profile.exportData;
	const { error, run } = useGameAction();
	const [busy, setBusy] = useState(false);

	async function exportData() {
		if (busy) return false;
		setBusy(true);
		try {
			return await run(async () => {
				const now = new Date();
				const data = await buildAccountExport({
					fetchPage: (cursor) =>
						convex.query(api.account.exportMyData, { cursor }),
					now,
				});
				saveFile(accountExportFileName(now), serializeAccountExport(data));
			}, copy.failed);
		} finally {
			setBusy(false);
		}
	}

	return { exportData, busy, ready: isAuthenticated, error };
}

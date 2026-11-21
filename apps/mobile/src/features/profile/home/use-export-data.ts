/**
 * "Download my data" on Profile; the steps live in
 * `@arcadeclub/core/account-export`, shared with the web Account page. The
 * file also holds what this phone keeps only locally (`localOnly`, see
 * `local-only-export.ts`): the name typed here, the pass-and-play backgammon
 * match, the online seats, and the sudoku saves that have no account session
 * yet. Synced puzzles are in the account export itself. It is written to the
 * cache directory and handed to the share sheet, so the player saves it to
 * Files or sends it on.
 */
import {
	accountExportFileName,
	buildAccountExport,
	serializeAccountExport,
} from "@arcadeclub/core/account-export";
import { useAuth } from "@clerk/expo";
import { useConvex } from "convex/react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "../../../convex/api";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { useSessionAction } from "../../sessions/use-session-action";
import { readLocalOnlyExport } from "./local-only-export";

export function useExportData(dialogTitle: string) {
	const convex = useConvex();
	const { userId } = useAuth();
	const backendAuth = useBackendAuthReady();
	const { run, busy, error } = useSessionAction();

	async function exportData() {
		if (busy) return;
		await run(async () => {
			const now = new Date();
			const data = await buildAccountExport({
				fetchPage: (cursor) =>
					convex.query(api.account.exportMyData, { cursor }),
				now,
				localOnly: readLocalOnlyExport(userId ?? null),
			});
			const file = new File(Paths.cache, accountExportFileName(now));
			file.create({ overwrite: true });
			await file.write(serializeAccountExport(data));
			await Sharing.shareAsync(file.uri, {
				mimeType: "application/json",
				UTI: "public.json",
				dialogTitle,
			});
		});
	}

	return { exportData, busy, ready: backendAuth.ready, error };
}

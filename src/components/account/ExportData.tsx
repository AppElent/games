/**
 * "Download my data" on the Account page: the account's Arcade Club data as
 * a dated JSON file (`useExportData`). A failure shows below the button.
 */
import { useExportData } from "#/lib/account/use-export-data";
import { useMessages } from "#/lib/i18n";

export function ExportData() {
	const copy = useMessages().profile.exportData;
	const exporter = useExportData();

	return (
		<section className="rm-panel mt-6 p-4" aria-labelledby="export-data-title">
			<h2 id="export-data-title" className="rm-label">
				{copy.title}
			</h2>
			<p className="mt-2 mb-4 text-sm text-[var(--club-muted)]">{copy.body}</p>
			<button
				type="button"
				onClick={() => void exporter.exportData()}
				disabled={!exporter.ready || exporter.busy}
				aria-busy={exporter.busy}
				className="rounded-md club-btn-outline px-4 py-2 font-bold text-[var(--club-text)] disabled:opacity-50"
			>
				{exporter.busy ? copy.exporting : copy.action}
			</button>
			{exporter.error ? (
				<p role="alert" className="mt-3 text-sm text-[var(--club-orange)]">
					{exporter.error}
				</p>
			) : null}
		</section>
	);
}

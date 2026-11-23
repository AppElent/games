/**
 * "Manage your AppElent account" on the Account page: the shared login's
 * emails, sign-in methods, devices and two-step verification live in the
 * central account portal, which opens in a new tab.
 */
import { ACCOUNT_PORTAL_URL } from "@arcadeclub/core/account-portal";
import { ExternalLink } from "lucide-react";
import { useMessages } from "#/lib/i18n";

export function ManageAccount() {
	const copy = useMessages().profile.accountPortal;

	return (
		<section
			className="rm-panel mt-6 p-4"
			aria-labelledby="account-portal-title"
		>
			<h2 id="account-portal-title" className="rm-label">
				{copy.title}
			</h2>
			<p className="mt-2 mb-4 text-sm text-[var(--club-muted)]">{copy.body}</p>
			<a
				href={ACCOUNT_PORTAL_URL}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-2 rounded-md club-btn-outline px-4 py-2 font-bold text-[var(--club-text)] no-underline"
			>
				{copy.action}
				<ExternalLink aria-hidden="true" className="h-4 w-4" />{" "}
				<span className="sr-only">{copy.newTab}</span>
			</a>
		</section>
	);
}

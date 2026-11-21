/**
 * The home page's confirmation after "Delete Arcade Club data only": the data
 * is gone, the person is signed out here, and the AppElent login still works
 * in the other apps. Closing it drops `?deleted` from the address.
 */
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useMessages } from "#/lib/i18n";

export function DataDeletedNotice() {
	const messages = useMessages();
	const copy = messages.profile.deleteAccount.app;
	const navigate = useNavigate();

	return (
		<section
			role="status"
			aria-labelledby="data-deleted-title"
			className="club-panel mb-6 flex items-start gap-3 rounded-[18px] p-4"
		>
			<div className="flex-1">
				<h2
					id="data-deleted-title"
					className="font-bold text-[var(--club-text)]"
				>
					{copy.doneTitle}
				</h2>
				<p className="mt-1 text-sm text-[var(--club-muted)]">{copy.doneBody}</p>
			</div>
			<button
				type="button"
				onClick={() => void navigate({ to: "/", search: {}, replace: true })}
				aria-label={messages.common.actions.close}
				className="-m-2 flex h-11 w-11 items-center justify-center rounded-md text-[var(--club-muted)]"
			>
				<X aria-hidden size={20} />
			</button>
		</section>
	);
}

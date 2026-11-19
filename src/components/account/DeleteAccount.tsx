/**
 * "Delete account" on the Account page: a confirmation dialog, then the
 * shared deletion steps (`useDeleteAccount`). Confirming closes the dialog
 * first: it is modal, so Clerk's verify dialog, which an old sign-in opens,
 * would sit behind it and be unclickable. Progress and any refusal show in
 * the panel, where the button runs it again.
 */
import { useRef } from "react";
import { useDeleteAccount } from "#/lib/account/use-delete-account";
import { useMessages } from "#/lib/i18n";

export function DeleteAccount() {
	const messages = useMessages();
	const copy = messages.profile.deleteAccount;
	const deletion = useDeleteAccount();
	const dialog = useRef<HTMLDialogElement>(null);

	function open() {
		deletion.clearError();
		dialog.current?.showModal();
	}

	function confirm() {
		dialog.current?.close();
		void deletion.deleteAccount();
	}

	return (
		<section className="rm-panel mt-6 p-4">
			<button
				type="button"
				onClick={open}
				disabled={!deletion.ready || deletion.busy}
				aria-busy={deletion.busy}
				className="rounded-md club-btn-outline px-4 py-2 font-bold text-[var(--club-orange)] disabled:opacity-50"
			>
				{deletion.busy ? copy.deleting : copy.action}
			</button>
			{deletion.error ? (
				<p role="alert" className="mt-3 text-sm text-[var(--club-orange)]">
					{deletion.error}
				</p>
			) : null}
			<dialog
				ref={dialog}
				aria-labelledby="delete-account-title"
				aria-describedby="delete-account-body"
				className="club-panel m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-6 text-[var(--club-text)] backdrop:bg-black/60"
			>
				<h2 id="delete-account-title" className="mb-2 text-lg font-bold">
					{copy.confirmTitle}
				</h2>
				<p
					id="delete-account-body"
					className="mb-4 text-sm text-[var(--club-muted)]"
				>
					{copy.confirmBody}
				</p>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={() => dialog.current?.close()}
						className="rounded-md px-4 py-2 font-bold text-[var(--club-muted)]"
					>
						{messages.common.actions.cancel}
					</button>
					<button
						type="button"
						onClick={confirm}
						className="rounded-md club-btn-outline px-4 py-2 font-bold text-[var(--club-orange)]"
					>
						{copy.confirm}
					</button>
				</div>
			</dialog>
		</section>
	);
}

/**
 * "Delete account" on the Account page: a confirmation dialog, then the
 * shared deletion steps (`useDeleteAccount`). A refusal or failure shows in
 * the dialog, which stays open so the player can try again.
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

	function close() {
		if (deletion.busy) return;
		dialog.current?.close();
	}

	return (
		<section className="rm-panel mt-6 p-4">
			<p className="rm-label">{copy.action}</p>
			<button
				type="button"
				onClick={open}
				disabled={!deletion.ready}
				className="mt-3 rounded-md border border-[var(--club-line-strong)] px-4 py-2 font-bold text-[var(--club-orange)] disabled:opacity-50"
			>
				{copy.action}
			</button>
			<dialog
				ref={dialog}
				aria-labelledby="delete-account-title"
				aria-describedby="delete-account-body"
				onCancel={(event) => {
					if (deletion.busy) event.preventDefault();
				}}
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
				{deletion.error ? (
					<p role="alert" className="mb-4 text-sm text-[var(--club-orange)]">
						{deletion.error}
					</p>
				) : null}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						disabled={deletion.busy}
						onClick={close}
						className="rounded-md px-4 py-2 font-bold text-[var(--club-muted)]"
					>
						{messages.common.actions.cancel}
					</button>
					<button
						type="button"
						disabled={deletion.busy}
						aria-busy={deletion.busy}
						onClick={() => void deletion.deleteAccount()}
						className="rounded-md border border-[var(--club-line-strong)] px-4 py-2 font-bold text-[var(--club-orange)] disabled:opacity-50"
					>
						{copy.confirm}
					</button>
				</div>
			</dialog>
		</section>
	);
}

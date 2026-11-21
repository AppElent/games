/**
 * "Delete account" on the Account page. A dialog first asks what to delete,
 * Arcade Club's data only (listed first) or the whole AppElent account, then
 * confirms that choice; the shared steps (`useDeleteAccount`) do the rest.
 * Confirming closes the dialog first: it is modal, so Clerk's verify dialog,
 * which an old sign-in opens, would sit behind it and be unclickable.
 * Progress and any refusal show in the panel, where the button runs it again.
 */
import type { DeletionScope } from "@arcadeclub/core/account-deletion";
import { useRef, useState } from "react";
import { useDeleteAccount } from "#/lib/account/use-delete-account";
import { useMessages } from "#/lib/i18n";

const SCOPES: readonly DeletionScope[] = ["app", "account"];

export function DeleteAccount() {
	const messages = useMessages();
	const copy = messages.profile.deleteAccount;
	const deletion = useDeleteAccount();
	const dialog = useRef<HTMLDialogElement>(null);
	const [scope, setScope] = useState<DeletionScope>("app");
	const [confirming, setConfirming] = useState(false);

	function open() {
		deletion.clearError();
		setScope("app");
		setConfirming(false);
		dialog.current?.showModal();
	}

	function confirm() {
		dialog.current?.close();
		void deletion.deleteAccount(scope);
	}

	const chosen = copy[scope];

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
					{confirming ? chosen.confirmTitle : copy.chooseTitle}
				</h2>
				<p
					id="delete-account-body"
					className="mb-4 text-sm text-[var(--club-muted)]"
				>
					{confirming ? chosen.confirmBody : copy.chooseBody}
				</p>
				{confirming ? null : (
					<fieldset className="mb-4 flex flex-col gap-2">
						<legend className="sr-only">{copy.chooseTitle}</legend>
						{SCOPES.map((value) => {
							const selected = value === scope;
							return (
								<label
									key={value}
									className={`flex cursor-pointer items-start gap-3 rounded-md club-btn-outline p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--club-cyan)] ${selected ? "bg-[var(--club-accent-dim)]" : ""}`}
								>
									<input
										type="radio"
										name="delete-scope"
										value={value}
										checked={selected}
										onChange={() => setScope(value)}
										className="sr-only"
									/>
									<span
										aria-hidden
										className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-[var(--club-cyan)]" : "border-[var(--club-line-strong)]"}`}
									>
										{selected ? (
											<span className="h-2.5 w-2.5 rounded-full bg-[var(--club-cyan)]" />
										) : null}
									</span>
									<span className="flex flex-col gap-1">
										<span className="font-semibold">{copy[value].label}</span>
										<span className="text-sm text-[var(--club-muted)]">
											{copy[value].detail}
										</span>
									</span>
								</label>
							);
						})}
					</fieldset>
				)}
				<div className="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						onClick={() =>
							confirming ? setConfirming(false) : dialog.current?.close()
						}
						className="rounded-md px-4 py-2 font-bold text-[var(--club-muted)]"
					>
						{confirming
							? messages.common.actions.back
							: messages.common.actions.cancel}
					</button>
					<button
						type="button"
						onClick={() => (confirming ? confirm() : setConfirming(true))}
						className={`rounded-md club-btn-outline px-4 py-2 font-bold ${confirming ? "text-[var(--club-orange)]" : "text-[var(--club-text)]"}`}
					>
						{confirming ? chosen.confirm : copy.continue}
					</button>
				</div>
			</dialog>
		</section>
	);
}

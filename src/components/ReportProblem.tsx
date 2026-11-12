/**
 * "Report a problem" on the Account page: a message and an optional
 * screenshot, sent as Sentry user feedback. No name or email field; the
 * report carries only the route template and the opaque Clerk user id.
 */
import * as Sentry from "@sentry/react";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "#/lib/i18n";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Status = { kind: "error" | "success"; text: string } | null;

export function ReportProblem() {
	const text = useMessages().common.feedback;
	const router = useRouter();
	const dialog = useRef<HTMLDialogElement>(null);
	const [enabled, setEnabled] = useState(false);
	const [message, setMessage] = useState("");
	const [screenshot, setScreenshot] = useState<File>();
	const [screen, setScreen] = useState("/");
	const [pending, setPending] = useState(false);
	const [status, setStatus] = useState<Status>(null);

	// Local and development builds don't report; don't offer a dead button.
	useEffect(() => {
		setEnabled(Boolean(Sentry.getClient()?.getOptions().enabled));
	}, []);

	if (!enabled) return null;

	function open() {
		setScreen(router.state.matches.at(-1)?.routeId || "/");
		setStatus(null);
		dialog.current?.showModal();
	}

	function close() {
		if (pending) return;
		dialog.current?.close();
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (pending || !message.trim()) return;
		setPending(true);
		setStatus(null);
		try {
			const attachments = screenshot
				? [
						{
							filename: `feedback-screenshot.${screenshot.type.split("/")[1]}`,
							contentType: screenshot.type,
							data: new Uint8Array(await screenshot.arrayBuffer()),
						},
					]
				: undefined;
			await Sentry.sendFeedback(
				{
					message: message.trim(),
					tags: { screen },
					url: new URL(screen, window.location.origin).href,
				},
				{ attachments },
			);
			setMessage("");
			setScreenshot(undefined);
			dialog.current?.close();
			setStatus({ kind: "success", text: text.success });
		} catch {
			setStatus({ kind: "error", text: text.error });
		} finally {
			setPending(false);
		}
	}

	return (
		<section className="mt-6">
			<button
				type="button"
				onClick={open}
				className="rounded-md club-btn-outline px-4 py-2 font-bold text-[var(--club-text)]"
			>
				{text.report}
			</button>
			{status?.kind === "success" ? (
				<output className="mt-2 block text-sm text-[var(--club-muted)]">
					{status.text}
				</output>
			) : null}
			<dialog
				ref={dialog}
				aria-labelledby="report-problem-title"
				onCancel={(event) => {
					if (pending) event.preventDefault();
				}}
				className="club-panel m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-6 text-[var(--club-text)] backdrop:bg-black/60"
			>
				<h2 id="report-problem-title" className="mb-2 text-lg font-bold">
					{text.report}
				</h2>
				<p className="mb-4 text-sm text-[var(--club-muted)]">
					{text.description}
				</p>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<label className="flex flex-col gap-2 text-sm font-bold text-[var(--club-muted)]">
						{text.message}
						<textarea
							required
							maxLength={4000}
							value={message}
							disabled={pending}
							onChange={(event) => setMessage(event.target.value)}
							placeholder={text.placeholder}
							className="min-h-28 rounded-md border border-[var(--club-line-strong)] bg-[var(--club-panel-strong)] p-3 font-normal text-[var(--club-text)] placeholder:text-[var(--club-soft)]"
						/>
					</label>
					{screenshot ? (
						<div className="flex items-center justify-between gap-2 text-sm">
							<span className="truncate">{screenshot.name}</span>
							<button
								type="button"
								disabled={pending}
								onClick={() => setScreenshot(undefined)}
								className="font-bold text-[var(--club-muted)]"
							>
								{text.remove}
							</button>
						</div>
					) : (
						<label className="flex flex-col gap-2 text-sm font-bold text-[var(--club-muted)]">
							{text.add}
							<input
								type="file"
								accept={IMAGE_TYPES.join(",")}
								disabled={pending}
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (
										file &&
										(!IMAGE_TYPES.includes(file.type) ||
											file.size > MAX_IMAGE_BYTES)
									) {
										setStatus({ kind: "error", text: text.attachmentError });
										event.target.value = "";
										return;
									}
									setStatus(null);
									setScreenshot(file);
								}}
								className="font-normal"
							/>
						</label>
					)}
					{status?.kind === "error" ? (
						<p role="alert" className="text-sm text-[var(--club-orange)]">
							{status.text}
						</p>
					) : null}
					<div className="flex justify-end gap-2">
						<button
							type="button"
							disabled={pending}
							onClick={close}
							className="rounded-md px-4 py-2 font-bold text-[var(--club-muted)]"
						>
							{text.cancel}
						</button>
						<button
							type="submit"
							disabled={pending || !message.trim()}
							className="rounded-md bg-cyan-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-50"
						>
							{text.submit}
						</button>
					</div>
				</form>
			</dialog>
		</section>
	);
}

import { Check, Copy, Link as LinkIcon, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useMessages } from "#/lib/i18n";
import { canShareLinks, shareLink } from "#/lib/share-link";
import { useCopyFeedback } from "#/lib/use-copy-feedback";

export function QrSharePanel({ url, label }: { url: string; label: string }) {
	const messages = useMessages();
	const [qrSrc, setQrSrc] = useState("");
	const { copied, copy } = useCopyFeedback();
	// Only after mount: the server cannot know whether the browser has a sheet.
	const [canShare, setCanShare] = useState(false);
	const [copyFailed, setCopyFailed] = useState(false);

	useEffect(() => setCanShare(canShareLinks()), []);

	const copyLink = async () => {
		setCopyFailed(!(await copy(url)));
	};

	const share = async () => {
		// A sheet that refuses falls back to the clipboard; a closed one does nothing.
		if ((await shareLink(url, label)) === "unavailable") {
			await copyLink();
		}
	};

	useEffect(() => {
		let active = true;
		void QRCode.toDataURL(url, {
			margin: 1,
			width: 220,
			color: {
				dark: "#f8fafc",
				light: "#00000000",
			},
		}).then((src) => {
			if (active) {
				setQrSrc(src);
			}
		});
		return () => {
			active = false;
		};
	}, [url]);

	return (
		<section className="club-panel rounded-lg p-5">
			<div className="mb-4 flex items-center gap-2 text-white">
				<LinkIcon className="h-5 w-5 text-cyan-300" />
				<h2 className="club-title text-xl font-bold">{label}</h2>
			</div>
			<div className="mb-4 flex aspect-square w-full max-w-[220px] items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
				{qrSrc ? (
					<img
						src={qrSrc}
						alt={messages.common.qrShare.qrAlt}
						className="h-full w-full"
					/>
				) : (
					<span className="text-sm text-slate-400">
						{messages.common.qrShare.generating}
					</span>
				)}
			</div>
			<div className="rounded-md border border-dashed border-cyan-300/40 bg-cyan-300/10 p-4 text-sm text-cyan-50">
				{url}
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				{canShare ? (
					<button
						type="button"
						onClick={() => void share()}
						className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
					>
						<Share2 className="h-4 w-4" aria-hidden="true" />
						{messages.common.qrShare.shareLink}
					</button>
				) : null}
				<button
					type="button"
					onClick={() => void copyLink()}
					className={
						canShare
							? "club-btn-outline inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold text-white"
							: "inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
					}
				>
					{copied ? (
						<Check className="h-4 w-4" aria-hidden="true" />
					) : (
						<Copy className="h-4 w-4" aria-hidden="true" />
					)}
					{copied
						? messages.common.qrShare.linkCopied
						: messages.common.qrShare.copyLink}
				</button>
			</div>
			<p role="status" className="mt-2 text-sm text-orange-200">
				{copyFailed ? messages.common.qrShare.copyFailed : ""}
			</p>
			<p role="status" className="sr-only">
				{copied ? messages.common.qrShare.linkCopied : ""}
			</p>
		</section>
	);
}

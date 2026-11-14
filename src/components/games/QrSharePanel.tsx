import { Check, Copy, Link as LinkIcon, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useMessages } from "#/lib/i18n";
import { shareLink } from "#/lib/share-link";
import { useCopyFeedback } from "#/lib/use-copy-feedback";

export function QrSharePanel({ url, label }: { url: string; label: string }) {
	const messages = useMessages();
	const [qrSrc, setQrSrc] = useState("");
	const { copied, copy } = useCopyFeedback();
	const [shareCopied, setShareCopied] = useState(false);

	useEffect(() => {
		if (!shareCopied) return;
		const timer = window.setTimeout(() => setShareCopied(false), 2000);
		return () => window.clearTimeout(timer);
	}, [shareCopied]);

	const share = async () => {
		if ((await shareLink(url, label)) === "copied") {
			setShareCopied(true);
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
				<button
					type="button"
					onClick={() => void share()}
					className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
				>
					{shareCopied ? (
						<Check className="h-4 w-4" />
					) : (
						<Share2 className="h-4 w-4" />
					)}
					<span aria-live="polite">
						{shareCopied
							? messages.common.qrShare.linkCopied
							: messages.common.qrShare.shareLink}
					</span>
				</button>
				<button
					type="button"
					onClick={() => void copy(url)}
					className="inline-flex items-center gap-2 rounded-md border border-white/30 px-4 py-2 text-sm font-bold text-white"
				>
					{copied ? (
						<Check className="h-4 w-4" />
					) : (
						<Copy className="h-4 w-4" />
					)}
					<span aria-live="polite">
						{copied
							? messages.common.actions.copied
							: messages.common.qrShare.copyLink}
					</span>
				</button>
			</div>
		</section>
	);
}

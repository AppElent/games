import { Copy, Link as LinkIcon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useMessages } from "#/lib/i18n";

export function QrSharePanel({ url, label }: { url: string; label: string }) {
	const messages = useMessages();
	const [qrSrc, setQrSrc] = useState("");

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
			<button
				type="button"
				onClick={() => void navigator.clipboard.writeText(url)}
				className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
			>
				<Copy className="h-4 w-4" />
				{messages.common.qrShare.copyLink}
			</button>
		</section>
	);
}

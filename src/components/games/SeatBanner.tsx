export function SeatBanner({
	label,
	tone = "neutral",
}: {
	label: string;
	tone?: "neutral" | "success" | "warning";
}) {
	const className =
		tone === "success"
			? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
			: tone === "warning"
				? "border-orange-300/30 bg-orange-300/10 text-orange-100"
				: "border-white/10 bg-white/5 text-slate-200";

	return (
		<div className={`rounded-md border px-3 py-2 text-sm ${className}`}>
			{label}
		</div>
	);
}

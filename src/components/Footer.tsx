export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="mt-16 border-t border-white/10 px-4 py-8 text-sm text-[var(--club-muted)]">
			<div className="club-wrap flex flex-col justify-between gap-3 sm:flex-row">
				<p className="m-0">&copy; {year} Arcade Club.</p>
				<p className="m-0">
					Live rooms, challenge links, and future game nights.
				</p>
			</div>
		</footer>
	);
}

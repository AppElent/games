import { Link } from "@tanstack/react-router";

export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="mt-16 border-t border-[var(--club-line)] px-4 py-8 text-sm text-[var(--club-muted)]">
			<div className="club-wrap flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<p className="m-0">&copy; {year} Arcade Club.</p>
				<div className="flex items-center gap-4">
					<Link
						to="/about"
						className="text-[var(--club-muted)] no-underline hover:text-[var(--club-text)] hover:underline"
						activeProps={{ className: "text-[var(--club-text)] underline" }}
					>
						About
					</Link>
					<span className="m-0">
						Live rooms, challenge links, and future game nights.
					</span>
				</div>
			</div>
		</footer>
	);
}

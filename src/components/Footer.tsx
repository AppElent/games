import { Link } from "@tanstack/react-router";
import { fmt, useMessages } from "#/lib/i18n";

export default function Footer() {
	const year = new Date().getFullYear();
	const messages = useMessages();

	return (
		<footer className="mt-16 border-t border-[var(--club-line)] px-4 py-8 text-sm text-[var(--club-muted)]">
			<div className="club-wrap flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<p className="m-0">{fmt(messages.common.footer.copyright, { year })}</p>
				<div className="flex items-center gap-4">
					<Link
						to="/about"
						className="text-[var(--club-muted)] no-underline hover:text-[var(--club-text)] hover:underline"
						activeProps={{ className: "text-[var(--club-text)] underline" }}
					>
						{messages.common.footer.about}
					</Link>
					<span className="m-0">{messages.common.footer.tagline}</span>
				</div>
			</div>
		</footer>
	);
}

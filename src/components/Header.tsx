import { HeaderUser } from "@appelent/auth";
import { Link } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	return (
		<header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/72 px-4 backdrop-blur-xl">
			<nav className="club-wrap flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
				<Link
					to="/"
					className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-extrabold text-white no-underline"
				>
					<span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
						<Gamepad2 className="h-4 w-4" />
					</span>
					Arcade Club
				</Link>

				<div className="order-3 flex w-full items-center gap-4 text-sm font-bold sm:order-none sm:w-auto">
					{/*
					 * "Games" and the logo both point to "/" on purpose: the logo is the
					 * brand mark, while "Games" is the labeled catalog nav item that also
					 * carries the active-state highlight (via activeProps). Home is the
					 * game catalog, so there is no separate games-index route to link to.
					 */}
					<Link
						to="/"
						className="club-nav-link"
						activeProps={{ className: "club-nav-link is-active" }}
					>
						Games
					</Link>
					<Link
						to="/join"
						className="club-nav-link"
						activeProps={{ className: "club-nav-link is-active" }}
					>
						Join
					</Link>
					<Link
						to="/dashboard"
						className="club-nav-link"
						activeProps={{ className: "club-nav-link is-active" }}
					>
						Dashboard
					</Link>
				</div>

				<div className="ml-auto flex items-center gap-2">
					<HeaderUser />
					<ThemeToggle />
				</div>
			</nav>
		</header>
	);
}

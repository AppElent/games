import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { GameCatalog } from "#/components/games/GameCatalog";
import { authConfig } from "../../lib/auth-config";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	return (
		<>
			<SignedIn>
				<main className="club-wrap py-10">
					<p className="club-kicker mb-2">Dashboard</p>
					<h1 className="club-title mb-2 text-4xl font-bold text-[var(--club-text)]">
						Start a game
					</h1>
					<p className="mb-8 max-w-2xl text-[var(--club-muted)]">
						Pick a game to host or play. Share the room code or challenge link
						once you're in.
					</p>
					<GameCatalog />
				</main>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function RedirectToSignIn() {
	const navigate = useNavigate();

	useEffect(() => {
		navigate({ to: authConfig.paths.signIn });
	}, [navigate]);

	return null;
}

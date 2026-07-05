import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
					<h1 className="club-title mb-6 text-4xl font-bold text-[var(--club-text)]">
						Your game table
					</h1>
					<div className="grid gap-4 md:grid-cols-2">
						<a
							href="/quiz/new"
							className="club-panel rounded-lg p-5 text-[var(--club-text)] no-underline"
						>
							<h2 className="club-title text-xl font-bold">Host a quiz</h2>
							<p className="mt-2 text-[var(--club-muted)]">
								Create a live room and invite players with a code.
							</p>
						</a>
						<a
							href="/backgammon/new"
							className="club-panel rounded-lg p-5 text-[var(--club-text)] no-underline"
						>
							<h2 className="club-title text-xl font-bold">Start backgammon</h2>
							<p className="mt-2 text-[var(--club-muted)]">
								Share a direct challenge link with one opponent.
							</p>
						</a>
					</div>
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

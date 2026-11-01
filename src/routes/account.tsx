import { Show } from "@clerk/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ProfilePanel } from "#/lib/auth";
import { ReportProblem } from "../components/ReportProblem";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/account")({
	component: AccountPage,
});

function AccountPage() {
	return (
		<>
			<Show when="signed-in">
				<main className="club-wrap py-10">
					<ProfilePanel />
					<ReportProblem />
				</main>
			</Show>
			<Show when="signed-out">
				<RedirectToSignIn />
			</Show>
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

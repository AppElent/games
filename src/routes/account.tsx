import { ProfilePanel } from "@appelent/auth";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authConfig } from "../lib/auth-config";

export const Route = createFileRoute("/account")({
	component: AccountPage,
});

function AccountPage() {
	return (
		<>
			<SignedIn>
				<main className="club-wrap py-10">
					<ProfilePanel />
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

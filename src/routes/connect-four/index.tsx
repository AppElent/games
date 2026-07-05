import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/connect-four/")({
	beforeLoad: () => {
		throw redirect({ to: "/connect-four/new" });
	},
});

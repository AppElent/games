import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/chess/")({
	beforeLoad: () => {
		throw redirect({ to: "/chess/new" });
	},
});

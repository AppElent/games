import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bluff-dice/")({
	beforeLoad: () => {
		throw redirect({ to: "/bluff-dice/new" });
	},
});

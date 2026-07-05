import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/backgammon/")({
	beforeLoad: () => {
		throw redirect({ to: "/backgammon/new" });
	},
});

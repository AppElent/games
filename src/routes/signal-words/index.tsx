import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signal-words/")({
	beforeLoad: () => {
		throw redirect({ to: "/signal-words/new" });
	},
});

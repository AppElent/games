import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/beat-the-clock/")({
	beforeLoad: () => {
		throw redirect({ to: "/beat-the-clock/new" });
	},
});

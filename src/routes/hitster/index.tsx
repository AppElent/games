import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/hitster/")({
	beforeLoad: () => {
		throw redirect({ to: "/hitster/new" });
	},
});

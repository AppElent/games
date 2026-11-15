import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bluff-dice/")({
	beforeLoad: () => {
		throw redirect({
			to: "/dice/$gameId",
			params: { gameId: "liars-dice" },
			replace: true,
		});
	},
});

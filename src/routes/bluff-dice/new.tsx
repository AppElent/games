import { createFileRoute, redirect } from "@tanstack/react-router";

/** Bluff Dice is liar's dice now: new games start at its dice table setup. */
export const Route = createFileRoute("/bluff-dice/new")({
	beforeLoad: () => {
		throw redirect({
			to: "/dice/$gameId",
			params: { gameId: "liars-dice" },
			replace: true,
		});
	},
});

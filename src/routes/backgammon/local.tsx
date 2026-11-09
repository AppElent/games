import { createFileRoute } from "@tanstack/react-router";
import { BackgammonLocalMatch } from "#/components/backgammon/BackgammonLocalMatch";

export const Route = createFileRoute("/backgammon/local")({
	component: BackgammonLocalMatch,
	staticData: { fullscreen: true },
});

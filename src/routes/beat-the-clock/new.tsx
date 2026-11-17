import { createFileRoute } from "@tanstack/react-router";
import { ClockSetup } from "#/components/beat-the-clock/ClockSetup";

export const Route = createFileRoute("/beat-the-clock/new")({
	component: ClockSetup,
	staticData: { fullscreen: true },
});

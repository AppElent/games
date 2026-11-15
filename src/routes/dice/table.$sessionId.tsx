import { createFileRoute } from "@tanstack/react-router";
import { DiceTableScreen } from "#/components/dice/DiceTableScreen";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/dice/table/$sessionId")({
	component: DiceTablePage,
	staticData: { fullscreen: true },
});

function DiceTablePage() {
	const { sessionId } = Route.useParams();
	return <DiceTableScreen sessionId={sessionId as Id<"gameSessions">} />;
}

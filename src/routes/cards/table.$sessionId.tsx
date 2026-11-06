import { createFileRoute } from "@tanstack/react-router";
import { CardTableScreen } from "#/components/cards/CardTableScreen";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/cards/table/$sessionId")({
	component: CardTablePage,
	staticData: { fullscreen: true },
});

function CardTablePage() {
	const { sessionId } = Route.useParams();
	return <CardTableScreen sessionId={sessionId as Id<"gameSessions">} />;
}

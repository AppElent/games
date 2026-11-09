import { useLocalSearchParams } from "expo-router";
import { CardTableScreen } from "../../../src/features/cards/table/card-table-screen";

export default function CardTableRoute() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
	return <CardTableScreen key={sessionId} sessionId={sessionId} />;
}

import { useLocalSearchParams } from "expo-router";
import { DiceTableScreen } from "../../../src/features/dice/table/dice-table-screen";

export default function DiceTableRoute() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
	return <DiceTableScreen key={sessionId} sessionId={sessionId} />;
}

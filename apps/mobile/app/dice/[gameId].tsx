import { useLocalSearchParams } from "expo-router";
import { DiceSetupScreen } from "../../src/features/dice/setup/dice-setup-screen";

export default function DiceSetupRoute() {
	const { gameId } = useLocalSearchParams<{ gameId: string }>();
	return <DiceSetupScreen key={gameId} gameId={gameId} />;
}

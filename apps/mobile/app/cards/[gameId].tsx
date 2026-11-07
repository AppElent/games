import { useLocalSearchParams } from "expo-router";
import { CardSetupScreen } from "../../src/features/cards/setup/card-setup-screen";

export default function CardSetupRoute() {
	const { gameId } = useLocalSearchParams<{ gameId: string }>();
	return <CardSetupScreen key={gameId} gameId={gameId} />;
}

import { useLocalSearchParams } from "expo-router";
import { OnlineMatchScreen } from "../../../src/features/backgammon/online/online-match-screen";

export default function BackgammonOnlineRoute() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
	return <OnlineMatchScreen key={sessionId} sessionId={sessionId} />;
}

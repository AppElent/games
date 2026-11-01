import { useLocalSearchParams } from "expo-router";
import { HitsterRoomScreen } from "../../src/features/hitster/room/hitster-room-screen";

export default function HitsterRoomRoute() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
	return <HitsterRoomScreen key={sessionId} sessionId={sessionId} />;
}

import { useLocalSearchParams } from "expo-router";
import { ClockRoomScreen } from "../../src/features/beat-the-clock/room/clock-room-screen";

export default function BeatTheClockRoomRoute() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
	return <ClockRoomScreen key={sessionId} sessionId={sessionId} />;
}

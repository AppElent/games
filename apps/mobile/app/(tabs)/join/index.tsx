/**
 * Room-code entry, and the target of invite links:
 * `https://arcade-club.appelent.nl/join?token=…` / `?code=…` and their
 * `arcadeclub://` form, routed here by `app/+native-intent.tsx`.
 */
import { useLocalSearchParams } from "expo-router";
import { JoinScreen } from "../../../src/features/sessions/join/join-screen";

export default function JoinRoute() {
	const { token, code } = useLocalSearchParams<{
		token?: string;
		code?: string;
	}>();
	// The tab stays mounted, so a new invite link remounts the form.
	return (
		<JoinScreen
			key={`${token ?? ""}:${code ?? ""}`}
			shareToken={token}
			initialCode={code}
		/>
	);
}

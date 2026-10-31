/**
 * Room-code entry, and the target of `arcadeclub://join?token=…` /
 * `?code=…` invite links.
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

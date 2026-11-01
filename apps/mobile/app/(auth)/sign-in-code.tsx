import { useLocalSearchParams } from "expo-router";
import { SignInCodeScreen } from "../../src/features/auth/sign-in/sign-in-code-screen";

export default function SignInCodeRoute() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <SignInCodeScreen email={email ?? ""} />;
}

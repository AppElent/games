import { useLocalSearchParams } from "expo-router";
import { VerifyEmailScreen } from "../../src/features/auth/sign-up/verify-email-screen";

export default function VerifyEmailRoute() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <VerifyEmailScreen email={email ?? ""} />;
}

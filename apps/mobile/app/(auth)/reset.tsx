import { useLocalSearchParams } from "expo-router";
import { PasswordResetScreen } from "../../src/features/auth/password-reset/password-reset-screen";

export default function ResetRoute() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <PasswordResetScreen initialEmail={email ?? ""} />;
}

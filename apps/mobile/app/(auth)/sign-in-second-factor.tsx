import { useLocalSearchParams } from "expo-router";
import { SecondFactorScreen } from "../../src/features/auth/second-factor/second-factor-screen";

export default function SecondFactorRoute() {
	const { from } = useLocalSearchParams<{ from?: string }>();
	return <SecondFactorScreen afterReset={from === "reset"} />;
}

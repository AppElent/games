import { Stack } from "expo-router";
import { BackgammonHomeScreen } from "../../src/features/backgammon/hub/backgammon-home-screen";
import { useI18n } from "../../src/i18n";

export default function BackgammonRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.backgammon.title }} />
			<BackgammonHomeScreen />
		</>
	);
}

import { Stack } from "expo-router";
import { DiceHubScreen } from "../../src/features/dice/hub/dice-hub-screen";
import { useI18n } from "../../src/i18n";

export default function DiceRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.catalog["dice-games"].title }} />
			<DiceHubScreen />
		</>
	);
}

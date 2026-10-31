import { Stack } from "expo-router";
import { HitsterSetupScreen } from "../../src/features/hitster/setup/hitster-setup-screen";
import { useI18n } from "../../src/i18n";

export default function HitsterRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.catalog.hitster.title }} />
			<HitsterSetupScreen />
		</>
	);
}

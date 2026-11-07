import { Stack } from "expo-router";
import { CardsHubScreen } from "../../src/features/cards/hub/cards-hub-screen";
import { useI18n } from "../../src/i18n";

export default function CardsRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.catalog["card-games"].title }} />
			<CardsHubScreen />
		</>
	);
}

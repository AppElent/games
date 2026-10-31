/**
 * The tab bar: Play, Join, Profile. Native tabs (`UITabBarController` /
 * `BottomNavigationView`), so iOS 26 gets Liquid Glass for free. iOS colours
 * come from `chrome` (trait-resolved) because the glass picks its own scheme
 * from the content beneath it.
 */
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { useI18n } from "../../src/i18n";
import { chrome, useTokens } from "../../src/theme";

export default function TabsLayout() {
	const colors = useTokens();
	const tint = Platform.OS === "ios" ? chrome : colors;
	const { t } = useI18n();
	return (
		<NativeTabs
			backgroundColor={Platform.OS === "ios" ? undefined : colors.surface}
			minimizeBehavior="onScrollDown"
			tintColor={tint.accent}
			iconColor={{ default: tint.textMuted, selected: tint.accent }}
			labelStyle={{
				default: { color: tint.textMuted },
				selected: { color: tint.accent },
			}}
		>
			<NativeTabs.Trigger name="(play)">
				<NativeTabs.Trigger.Label>
					{t.common.tabs.play}
				</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="gamecontroller.fill" md="sports_esports" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="join">
				<NativeTabs.Trigger.Label>
					{t.common.tabs.join}
				</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="ticket.fill" md="confirmation_number" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="profile">
				<NativeTabs.Trigger.Label>
					{t.common.tabs.profile}
				</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="person" />
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}

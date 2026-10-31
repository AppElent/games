import { useI18n } from "../../../src/i18n";
import { TabStack } from "../../../src/ui/tab-stack";

export default function ProfileTabLayout() {
	const { t } = useI18n();
	return <TabStack title={t.common.tabs.profile} />;
}

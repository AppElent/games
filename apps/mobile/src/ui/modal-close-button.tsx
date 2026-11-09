/**
 * Close for a modal's header. iOS shows it; Android closes a modal with the
 * system back, so its header gets no button.
 */
import { Platform } from "react-native";
import { useI18n } from "../i18n";
import { HeaderButton } from "./button";

function ModalCloseButton({ onPress }: { onPress: () => void }) {
	const { t } = useI18n();
	return <HeaderButton label={t.common.actions.close} onPress={onPress} />;
}

/** The `headerRight` option for a modal that closes with `onClose`. */
export function modalCloseHeaderRight(onClose: () => void) {
	return Platform.OS === "ios"
		? () => <ModalCloseButton onPress={onClose} />
		: undefined;
}

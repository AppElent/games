/** The account email, with the keyboard and autofill an address needs. */
import type { ComponentProps } from "react";
import { useI18n } from "../../../i18n";
import { TextField } from "../../../ui/text-field";

export function EmailField(
	props: Omit<ComponentProps<typeof TextField>, "label">,
) {
	const { t } = useI18n();
	return (
		<TextField
			label={t.auth.signIn.email}
			autoCapitalize="none"
			autoCorrect={false}
			keyboardType="email-address"
			autoComplete="email"
			textContentType="username"
			{...props}
		/>
	);
}

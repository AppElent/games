/** The emailed one-time code: digits only, filled from the message on iOS. */
import type { ComponentProps } from "react";
import { useI18n } from "../../../i18n";
import { TextField } from "../../../ui/text-field";

/** Digits in every code Clerk emails (sign-in, sign-up, password reset). */
export const AUTH_CODE_LENGTH = 6;

/** What a code field accepts: digits only. */
export const codeDigits = (text: string) => text.replace(/\D/g, "");

/**
 * Without `onEndEditing`, the code also syncs from the native text when
 * editing ends, for a code AutoFill set without `onChangeText`. Without
 * `onSubmitEditing`, the return key moves on.
 */
export function CodeField({
	onChangeText,
	onEndEditing,
	onSubmitEditing,
	...props
}: Omit<ComponentProps<typeof TextField>, "label">) {
	const { t } = useI18n();
	return (
		<TextField
			label={t.auth.signInCode.code}
			keyboardType="number-pad"
			autoComplete="one-time-code"
			textContentType="oneTimeCode"
			maxLength={AUTH_CODE_LENGTH}
			autoFocus
			returnKeyType={onSubmitEditing ? "go" : undefined}
			{...props}
			onChangeText={(text) => onChangeText?.(codeDigits(text))}
			onEndEditing={
				onEndEditing ??
				((event) => onChangeText?.(codeDigits(event.nativeEvent.text)))
			}
			onSubmitEditing={onSubmitEditing}
		/>
	);
}

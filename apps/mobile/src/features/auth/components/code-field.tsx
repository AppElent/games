/** The emailed one-time code: digits only, filled from the message on iOS. */
import { useI18n } from "../../../i18n";
import { TextField } from "../../../ui/text-field";

/** Digits in every code Clerk emails (sign-in, sign-up, password reset). */
export const AUTH_CODE_LENGTH = 6;

export function CodeField({
	value,
	onChange,
	onSubmit,
}: {
	value: string;
	onChange: (code: string) => void;
	/** Submits from the keyboard; without it the return key moves on. */
	onSubmit?: () => void;
}) {
	const { t } = useI18n();
	const digits = (text: string) => text.replace(/\D/g, "");
	return (
		<TextField
			label={t.auth.signInCode.code}
			value={value}
			onChangeText={(next) => onChange(digits(next))}
			onEndEditing={(event) => onChange(digits(event.nativeEvent.text))}
			keyboardType="number-pad"
			autoComplete="one-time-code"
			textContentType="oneTimeCode"
			maxLength={AUTH_CODE_LENGTH}
			autoFocus
			returnKeyType={onSubmit ? "go" : undefined}
			onSubmitEditing={onSubmit}
		/>
	);
}

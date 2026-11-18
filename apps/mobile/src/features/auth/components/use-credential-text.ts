/**
 * The text of a credential field (email, password, code) as password managers
 * leave it. iOS AutoFill can set or clear a field without `onChangeText`, for
 * example when the strong-password offer is declined, so the field also syncs
 * from `onEndEditing` and from the keyboard's submit, and `read()` returns the
 * latest text for a submit started in the same event.
 */
import { useCallback, useRef, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";

/**
 * iOS `passwordRules` for every new-password field, so a generated password
 * passes Clerk. The Clerk instances keep Clerk's default policy: at least 8
 * characters and no required character classes.
 */
export const NEW_PASSWORD_RULES = "minlength: 8;";

type TextEvent = NativeSyntheticEvent<{ text: string }>;

/** Field props that keep `sync` up to date with the native text. */
export function syncedFieldProps(
	value: string,
	sync: (text: string) => void,
	onSubmit?: () => void,
) {
	return {
		value,
		onChangeText: sync,
		onEndEditing: (event: TextEvent) => sync(event.nativeEvent.text),
		onSubmitEditing: (event: TextEvent) => {
			sync(event.nativeEvent.text);
			onSubmit?.();
		},
	};
}

export function useCredentialText(initial = "") {
	const [text, setText] = useState(initial);
	const latest = useRef(initial);
	const sync = useCallback((next: string) => {
		latest.current = next;
		setText(next);
	}, []);
	const read = useCallback(() => latest.current, []);
	const field = (onSubmit?: () => void) =>
		syncedFieldProps(text, sync, onSubmit);
	return { text, read, sync, field };
}

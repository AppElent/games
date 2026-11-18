/**
 * The fields of an auth form as password managers leave them. iOS AutoFill
 * can set or clear a field without `onChangeText`, for example when the
 * strong-password offer is declined, so each field also syncs from
 * `onEndEditing`, and every action reads the latest text.
 *
 * A button press does not blur the focused field (`Screen` keeps taps with
 * `keyboardShouldPersistTaps`), so `press` blurs it and runs the action from
 * that field's `onEndEditing`, after the native text has synced. The primary
 * button stays enabled while a field is focused, because the text it shows
 * may not be the text the field holds.
 */
import { useState } from "react";
import {
	type NativeSyntheticEvent,
	TextInput,
	type TextInputProps,
} from "react-native";

/**
 * iOS `passwordRules` for every new-password field, so a generated password
 * passes Clerk. The Clerk instances keep Clerk's default policy: at least 8
 * characters and no required character classes.
 */
export const NEW_PASSWORD_RULES = "minlength: 8;";

type TextEvent = NativeSyntheticEvent<{ text: string }>;
type Action<K extends string> = (values: Record<K, string>) => void;

/** The form's logic without React, so it can be tested on its own. */
export function credentialForm<K extends string>(
	initial: Record<K, string>,
	render: {
		values: (values: Record<K, string>) => void;
		editing: (editing: boolean) => void;
	},
) {
	let latest = initial;
	let pending: Action<K> | null = null;
	let focused: K | null = null;
	const set = (key: K, text: string) => {
		latest = { ...latest, [key]: text };
		render.values(latest);
	};
	const run = (action: Action<K>) => {
		pending = null;
		action(latest);
	};
	return {
		/** Props for the field `key`; `clean` filters what it accepts. */
		field: (
			key: K,
			value: string,
			clean: (text: string) => string = (text) => text,
		) =>
			({
				value,
				onChangeText: (text: string) => set(key, clean(text)),
				onFocus: () => {
					pending = null;
					focused = key;
					render.editing(true);
				},
				onEndEditing: (event: TextEvent) => {
					set(key, clean(event.nativeEvent.text));
					// Moving to the next field can focus it before this one ends.
					if (focused === key) {
						focused = null;
						render.editing(false);
					}
					if (pending) run(pending);
				},
			}) satisfies TextInputProps,
		/** A button's `onPress`: runs `action` once the focused field synced. */
		press: (action: Action<K>) => {
			const input = TextInput.State.currentlyFocusedInput();
			if (input) {
				pending = action;
				input.blur();
			} else {
				run(action);
			}
		},
		/** A field's `onSubmitEditing`: syncs its native text, then runs `action`. */
		submitFrom:
			(key: K, action: Action<K>) =>
			(event: TextEvent): void => {
				set(key, event.nativeEvent.text);
				run(action);
			},
	};
}

export function useCredentialForm<K extends string>(
	initial: Record<K, string>,
) {
	const [values, setValues] = useState(initial);
	const [editing, setEditing] = useState(false);
	const [form] = useState(() =>
		credentialForm(initial, { values: setValues, editing: setEditing }),
	);
	return {
		values,
		/** A field is focused, so the primary button stays enabled. */
		editing,
		field: (key: K, clean?: (text: string) => string) =>
			form.field(key, values[key], clean),
		press: form.press,
		submitFrom: form.submitFrom,
	};
}

import type { NativeSyntheticEvent } from "react-native";
import { syncedFieldProps } from "./use-credential-text";

const event = (text: string) =>
	({ nativeEvent: { text } }) as NativeSyntheticEvent<{ text: string }>;

describe("syncedFieldProps", () => {
	it("syncs typed text", () => {
		const sync = jest.fn();
		syncedFieldProps("", sync).onChangeText("a@b.com");
		expect(sync).toHaveBeenCalledWith("a@b.com");
	});

	it("syncs text AutoFill set or cleared without onChangeText", () => {
		const sync = jest.fn();
		const field = syncedFieldProps("old secret", sync);
		field.onEndEditing(event(""));
		expect(sync).toHaveBeenLastCalledWith("");
		field.onEndEditing(event("Generated-pw1"));
		expect(sync).toHaveBeenLastCalledWith("Generated-pw1");
	});

	it("syncs the native text before submitting from the keyboard", () => {
		const order: string[] = [];
		const field = syncedFieldProps(
			"",
			(text) => order.push(`sync:${text}`),
			() => order.push("submit"),
		);
		field.onSubmitEditing(event("filled"));
		expect(order).toEqual(["sync:filled", "submit"]);
	});
});

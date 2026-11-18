import { type NativeSyntheticEvent, TextInput } from "react-native";
import { credentialForm } from "./use-credential-form";

const event = (text: string) =>
	({ nativeEvent: { text } }) as NativeSyntheticEvent<{ text: string }>;

function setup(initial = { email: "", password: "" }) {
	const rendered = { values: initial, editing: false };
	const form = credentialForm(initial, {
		values: (values) => {
			rendered.values = values;
		},
		editing: (editing) => {
			rendered.editing = editing;
		},
	});
	return { form, rendered };
}

/** The field the user is in, as `TextInput.State` reports it. */
function focus(blur: () => void) {
	jest
		.spyOn(TextInput.State, "currentlyFocusedInput")
		.mockReturnValue({ blur } as unknown as ReturnType<
			typeof TextInput.State.currentlyFocusedInput
		>);
}

afterEach(() => jest.restoreAllMocks());

describe("credentialForm", () => {
	it("syncs typed text", () => {
		const { form, rendered } = setup();
		form.field("email", "").onChangeText("a@b.com");
		expect(rendered.values.email).toBe("a@b.com");
	});

	it("syncs text AutoFill set or cleared without onChangeText", () => {
		const { form, rendered } = setup({ email: "", password: "old secret" });
		const field = form.field("password", "old secret");
		field.onEndEditing(event(""));
		expect(rendered.values.password).toBe("");
		field.onEndEditing(event("Generated-pw1"));
		expect(rendered.values.password).toBe("Generated-pw1");
	});

	it("keeps the button enabled while a field is focused", () => {
		const { form, rendered } = setup();
		form.field("email", "").onFocus();
		expect(rendered.editing).toBe(true);
		form.field("email", "").onEndEditing(event(""));
		expect(rendered.editing).toBe(false);
	});

	it("stays editing when the next field focuses before the last one ends", () => {
		const { form, rendered } = setup();
		form.field("email", "").onFocus();
		form.field("password", "").onFocus();
		form.field("email", "").onEndEditing(event("a@b.com"));
		expect(rendered.editing).toBe(true);
	});

	it("submits AutoFill text when the button is pressed in a focused field", () => {
		const { form } = setup();
		const submit = jest.fn();
		const password = form.field("password", "");
		form.field("email", "").onChangeText("a@b.com");
		password.onFocus();
		// AutoFill fills the password without onChangeText; the button is pressed
		// before the field ends editing.
		const blur = jest.fn(() => password.onEndEditing(event("Filled-pw1")));
		focus(blur);
		form.press(submit);
		expect(blur).toHaveBeenCalled();
		expect(submit).toHaveBeenCalledTimes(1);
		expect(submit).toHaveBeenCalledWith({
			email: "a@b.com",
			password: "Filled-pw1",
		});
	});

	it("submits at once when no field is focused", () => {
		const { form } = setup({ email: "a@b.com", password: "pw-12345" });
		const submit = jest.fn();
		jest
			.spyOn(TextInput.State, "currentlyFocusedInput")
			.mockReturnValue(undefined);
		form.press(submit);
		expect(submit).toHaveBeenCalledWith({
			email: "a@b.com",
			password: "pw-12345",
		});
	});

	it("does not submit when the field only ends editing after a press was dropped", () => {
		const { form } = setup();
		const submit = jest.fn();
		const email = form.field("email", "");
		focus(jest.fn());
		form.press(submit);
		email.onFocus();
		email.onEndEditing(event("a@b.com"));
		expect(submit).not.toHaveBeenCalled();
	});

	it("syncs the native text before submitting from the keyboard", () => {
		const { form } = setup({ email: "a@b.com", password: "" });
		const submit = jest.fn();
		form.submitFrom("password", submit)(event("Filled-pw1"));
		expect(submit).toHaveBeenCalledWith({
			email: "a@b.com",
			password: "Filled-pw1",
		});
	});

	it("applies the field's filter to AutoFill text", () => {
		const { form, rendered } = setup({ email: "", password: "" });
		const digits = (text: string) => text.replace(/\D/g, "");
		form.field("email", "", digits).onEndEditing(event("12 34-56"));
		expect(rendered.values.email).toBe("123456");
	});
});

import type { AuthErrorKey } from "@arcadeclub/core/auth-errors";
import { messages } from "@arcadeclub/core/messages";
import { useUser } from "@clerk/expo";
import { fireEvent, screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { ReverifySheet } from "./reverify-sheet";
import type { useReverify } from "./use-reverify";

const t = messages.en;
const copy = t.profile.reverify;

type Reverify = ReturnType<typeof useReverify>;

async function open(state: Partial<Reverify>) {
	const reverify = {
		verify: jest.fn(),
		method: "password",
		email: null,
		busy: false,
		sending: false,
		errorKey: null,
		codeSent: false,
		submit: jest.fn(),
		sendCode: jest.fn(),
		cancel: jest.fn(),
		...state,
	} as jest.Mocked<Reverify>;
	await renderScreen(<ReverifySheet reverify={reverify} />);
	return reverify;
}

beforeEach(() => {
	jest.mocked(useUser).mockReturnValue({
		user: { primaryEmailAddress: { emailAddress: "ann@example.com" } },
	} as never);
});

describe("ReverifySheet", () => {
	it("stays closed until something asks for it", async () => {
		await open({ method: null });
		expect(screen.queryByText(copy.title)).toBeNull();
	});

	it("confirms with the password", async () => {
		const reverify = await open({});
		expect(screen.getByText(copy.title)).toBeTruthy();
		expect(screen.getByDisplayValue("ann@example.com")).toBeTruthy();
		expect(screen.queryByLabelText(copy.emailCode)).toBeNull();
		await fireEvent.changeText(
			screen.getByLabelText(t.auth.signIn.password),
			"secret",
		);
		await fireEvent.press(screen.getByLabelText(copy.submit));
		expect(reverify.submit).toHaveBeenCalledWith("secret");
	});

	it("does not submit an empty password", async () => {
		const reverify = await open({});
		await fireEvent.press(screen.getByLabelText(copy.submit));
		expect(reverify.submit).not.toHaveBeenCalled();
	});

	it("offers a code instead of the password when Clerk does", async () => {
		const reverify = await open({ email: "a***@example.com" });
		await fireEvent.press(screen.getByLabelText(copy.emailCode));
		expect(reverify.sendCode).toHaveBeenCalledTimes(1);
	});

	it("confirms with a whole emailed code and can send another", async () => {
		const reverify = await open({ method: "code", email: "a***@example.com" });
		expect(screen.getByText(/a\*\*\*@example\.com/)).toBeTruthy();
		const field = screen.getByLabelText(t.auth.signInCode.code);
		await fireEvent.changeText(field, "12345");
		await fireEvent.press(screen.getByLabelText(copy.submit));
		expect(reverify.submit).not.toHaveBeenCalled();
		await fireEvent.changeText(field, "123456");
		await fireEvent.press(screen.getByLabelText(copy.submit));
		expect(reverify.submit).toHaveBeenCalledWith("123456");
		await fireEvent.press(screen.getByLabelText(t.auth.signInCode.resend));
		expect(reverify.sendCode).toHaveBeenCalledTimes(1);
	});

	it.each<[Reverify["method"], AuthErrorKey]>([
		["password", "passwordIncorrect"],
		["code", "codeIncorrect"],
	])("shows a wrong %s inline", async (method, errorKey) => {
		await open({ method, errorKey });
		expect(screen.getByText(t.auth.errors[errorKey])).toBeTruthy();
	});

	it("cancels", async () => {
		const reverify = await open({});
		await fireEvent.press(screen.getByLabelText(t.common.actions.cancel));
		expect(reverify.cancel).toHaveBeenCalledTimes(1);
	});
});

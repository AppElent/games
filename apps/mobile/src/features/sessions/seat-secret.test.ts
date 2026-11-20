import { isSeatSecret } from "@arcadeclub/core/sessions";
import { newSeatSecret } from "./seat-secret";

const mockRandomUUID = jest.fn();

jest.mock("expo-crypto", () => ({
	randomUUID: () => mockRandomUUID(),
}));

describe("newSeatSecret", () => {
	it("makes the shape the server takes, in either case a native UUID comes in", () => {
		for (const uuid of [
			"0f8fad5b-d9cb-469f-a165-70867728950e",
			"0F8FAD5B-D9CB-469F-A165-70867728950E",
		]) {
			mockRandomUUID.mockReturnValue(uuid);
			const secret = newSeatSecret();
			expect(secret).toBe(`${uuid}${uuid}`);
			expect(isSeatSecret(secret)).toBe(true);
		}
	});
});

import { onlineStatus } from "./online-status";

type Bundle = NonNullable<Parameters<typeof onlineStatus>[0]>;

function bundle(status: Bundle["session"]["status"]): Bundle {
	return {
		session: { status, joinCode: "ABCDEF" },
		participants: [
			{ _id: "me", displayName: "Me" },
			{ _id: "anna", displayName: "Anna" },
			{ _id: "gone", displayName: "Gone", kickedAt: 1 },
		],
	} as unknown as Bundle;
}

describe("onlineStatus", () => {
	it("is loading until the bundle arrives", () => {
		expect(onlineStatus(undefined, "me")).toBeUndefined();
	});

	it("hides deleted and finished games", () => {
		expect(onlineStatus(null, "me")).toBeNull();
		expect(onlineStatus(bundle("completed"), "me")).toBeNull();
		expect(onlineStatus(bundle("cancelled"), "me")).toBeNull();
	});

	it("names the other players still in the game", () => {
		expect(onlineStatus(bundle("active"), "me")).toEqual({
			phase: "active",
			others: ["Anna"],
			joinCode: "ABCDEF",
		});
	});
});

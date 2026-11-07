import { seatSecretAfterJoin } from "./seat-secret";

const base = {
	gameType: "card-games",
	participantId: "seat-1",
	seatClaimed: false,
	newSecret: "new",
};

describe("seatSecretAfterJoin", () => {
	it("keeps the secret a returning seat already holds", () => {
		expect(
			seatSecretAfterJoin({
				...base,
				existing: { participantId: "seat-1", seatSecret: "held" },
			}),
		).toBe("held");
	});

	it("uses the new secret when the join claimed the seat", () => {
		expect(
			seatSecretAfterJoin({
				...base,
				seatClaimed: true,
				existing: { participantId: "seat-1", seatSecret: "held" },
			}),
		).toBe("new");
	});

	it("uses the new secret for an account's seat this phone has never held", () => {
		expect(seatSecretAfterJoin(base)).toBe("new");
		expect(
			seatSecretAfterJoin({
				...base,
				existing: { participantId: "other-seat", seatSecret: "held" },
			}),
		).toBe("new");
	});

	it("stores nothing for games without seat secrets", () => {
		expect(
			seatSecretAfterJoin({ ...base, gameType: "hitster", seatClaimed: true }),
		).toBeUndefined();
	});
});

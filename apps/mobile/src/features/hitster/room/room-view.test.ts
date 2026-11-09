import { listHitsterPacks } from "@arcadeclub/core/hitster-packs";
import {
	type HitsterBundle,
	type LiveRoomView,
	lobbyPlayers,
	roomView,
	showsOwnTimeline,
	timelineCards,
	timelineFor,
} from "./room-view";

const pack = listHitsterPacks()[0];
const [first, second, third] = pack.cards;

function bundle(mode: string, overrides: Record<string, unknown> = {}) {
	return {
		session: { hostParticipantId: "host" },
		participants: [
			{ _id: "host", displayName: "Ana" },
			{ _id: "guest", displayName: "Bo" },
		],
		state: {
			mode,
			packId: pack.id,
			phase: "nowPlaying",
			turnOrder: ["host", "guest"],
			activeIndex: 1,
			timelines:
				mode === "coop"
					? [{ cardIds: [first.id] }]
					: [
							{ participantId: "host", cardIds: [first.id] },
							{ participantId: "guest", cardIds: [second.id, third.id] },
						],
			tokens: [
				{ participantId: "host", tokens: 2 },
				{ participantId: "guest", tokens: 0 },
			],
			stealClaims: [{ participantId: "host", dropIndex: 0, submittedAt: 1 }],
			...overrides,
		},
	} as unknown as HitsterBundle;
}

describe("hitster room view", () => {
	it("knows the host, the active player and the steal state", () => {
		const view = roomView(bundle("original"), "host");
		expect(view.isHost).toBe(true);
		if (!view.state) throw new Error("state");
		expect(view.isActive).toBe(false);
		expect(view.activeParticipantId).toBe("guest");
		expect(view.myTokens).toBe(2);
		expect(view.hasClaimed).toBe(true);
		expect(view.myTimeline?.cardIds).toEqual([first.id]);
	});

	it("treats a phone outside the turn order as a watcher", () => {
		const view = roomView(bundle("original"), "stranger");
		if (!view.state) throw new Error("state");
		expect(view.isPlaying).toBe(false);
		expect(view.isActive).toBe(false);
	});

	it("uses the shared timeline in co-op", () => {
		const { state } = bundle("coop");
		expect(timelineFor(state as never, "guest")?.cardIds).toEqual([first.id]);
	});

	it("resolves card ids and drops unknown ones", () => {
		const cards = timelineCards({ packId: pack.id }, [second.id, "nope"]);
		expect(cards.map((card) => card.title)).toEqual([second.title]);
	});

	it("counts joined players without watchers or kicked players", () => {
		const room = {
			participants: [
				{ _id: "host", role: "host" },
				{ _id: "guest", role: "player" },
				{ _id: "fan", role: "watcher" },
				{ _id: "gone", role: "player", kickedAt: 1 },
			],
		} as unknown as HitsterBundle;
		expect(lobbyPlayers(room).map((entry) => entry._id)).toEqual([
			"host",
			"guest",
		]);
	});

	describe("own timeline", () => {
		const live = (
			participantId: string,
			overrides: Record<string, unknown> = {},
		) => roomView(bundle("original", overrides), participantId) as LiveRoomView;

		it("shows to a watcher of someone else's turn", () => {
			expect(showsOwnTimeline(live("host"), false)).toBe(true);
		});

		it("hides in the lobby and for a phone with no timeline", () => {
			expect(showsOwnTimeline(live("host", { phase: "lobby" }), false)).toBe(
				false,
			);
			expect(showsOwnTimeline(live("stranger"), false)).toBe(false);
		});

		it("hides while the active player places, and shows once locked", () => {
			expect(showsOwnTimeline(live("guest"), false)).toBe(false);
			expect(
				showsOwnTimeline(
					live("guest", { pendingGuess: { dropIndex: 0 } }),
					false,
				),
			).toBe(true);
			expect(showsOwnTimeline(live("guest", { phase: "reveal" }), false)).toBe(
				true,
			);
		});

		it("hides behind an open steal form until the steal is claimed", () => {
			const unclaimed = { stealClaims: [] };
			expect(showsOwnTimeline(live("host", unclaimed), true)).toBe(false);
			expect(showsOwnTimeline(live("host"), true)).toBe(true);
		});
	});
});

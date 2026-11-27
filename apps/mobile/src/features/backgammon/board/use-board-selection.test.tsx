import {
	type BackgammonMovePlan,
	type BackgammonTurnState,
	createInitialBackgammonState,
	planBackgammonMove,
} from "@arcadeclub/core/backgammon";
import { messages } from "@arcadeclub/core/messages";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { LocaleProvider } from "../../../i18n";
import { useBoardSelection } from "./use-board-selection";

jest.mock("../../../feedback/haptics", () => ({
	haptics: {
		selectionChanged: jest.fn(),
		checkerLifted: jest.fn(),
		targetEntered: jest.fn(),
		moveMade: jest.fn(),
		checkerHit: jest.fn(),
		moveRejected: jest.fn(),
		gameWon: jest.fn(),
	},
}));

const board = messages.en.games.backgammon.board;

function rolled(dice: number[]): BackgammonTurnState {
	return {
		...createInitialBackgammonState(),
		dice,
		used: dice.map(() => false),
	};
}

/** Every haptic played so far, by name, in order. */
function played() {
	return Object.entries(haptics)
		.flatMap(([name, fn]) =>
			jest
				.mocked(fn)
				.mock.invocationCallOrder.map((order) => ({ name, order })),
		)
		.sort((a, b) => a.order - b.order)
		.map(({ name }) => name);
}

async function setup(state: BackgammonTurnState, interactive = true) {
	const onPlan = jest.fn<unknown, [BackgammonMovePlan]>();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<LocaleProvider>{children}</LocaleProvider>
	);
	const hook = await renderHook(
		(props: { state: BackgammonTurnState; interactive: boolean }) =>
			useBoardSelection({ ...props, autoCombine: true, onPlan }),
		{ wrapper, initialProps: { state, interactive } },
	);
	return { ...hook, onPlan };
}

describe("dragging a checker", () => {
	beforeEach(() => jest.clearAllMocks());

	it("lifts only checkers that may move", async () => {
		const { result } = await setup(rolled([5, 3]));
		expect(result.current.draggable).toEqual([6, 8, 13, 24]);
		let lifted = true;
		await act(() => {
			lifted = result.current.liftChecker(12);
		});
		expect(lifted).toBe(false);
		await act(() => {
			lifted = result.current.liftChecker(8);
		});
		expect(lifted).toBe(true);
		expect(result.current.lifted).toBe(8);
		expect([...result.current.highlights.points].sort()).toEqual([3, 5]);
		expect(played()).toEqual(["checkerLifted"]);
	});

	it("ticks once on entering a lit point, never on leaving or unlit ones", async () => {
		const { result } = await setup(rolled([5, 3]));
		await act(() => void result.current.liftChecker(8));
		await act(() => result.current.moveOver(4));
		expect(result.current.hovered).toBeNull();
		await act(() => result.current.moveOver(5));
		expect(result.current.hovered).toBe(5);
		await act(() => result.current.moveOver(5));
		await act(() => result.current.moveOver(null));
		await act(() => result.current.moveOver(3));
		expect(played()).toEqual([
			"checkerLifted",
			"targetEntered",
			"targetEntered",
		]);
	});

	it("commits the tap plan on a lit point, with one move haptic", async () => {
		const state = rolled([5, 3]);
		const { result, onPlan } = await setup(state);
		await act(() => void result.current.liftChecker(8));
		await act(() => result.current.moveOver(3));
		await act(() => void result.current.dropChecker(3));
		expect(onPlan).toHaveBeenCalledWith(planBackgammonMove(state, 8, 3, true));
		expect(result.current.lifted).toBeNull();
		expect(result.current.notice).toBeNull();
		expect(played()).toEqual(["checkerLifted", "targetEntered", "moveMade"]);
	});

	it("calls back at once when the committed drop is refused", async () => {
		const { result, onPlan } = await setup(rolled([5, 3]));
		onPlan.mockReturnValueOnce(Promise.resolve(false));
		const refused = jest.fn();
		await act(() => void result.current.liftChecker(8));
		await act(async () => void result.current.dropChecker(3, refused));
		expect(onPlan).toHaveBeenCalledTimes(1);
		expect(refused).toHaveBeenCalledTimes(1);
	});

	it("does not call back when the committed drop is accepted", async () => {
		const { result, onPlan } = await setup(rolled([5, 3]));
		onPlan.mockReturnValueOnce(Promise.resolve(true));
		const refused = jest.fn();
		await act(() => void result.current.liftChecker(8));
		await act(async () => void result.current.dropChecker(3, refused));
		expect(onPlan).toHaveBeenCalledTimes(1);
		expect(refused).not.toHaveBeenCalled();
	});

	it("plays the hit, not the move, when the drop hits a blot", async () => {
		const state = rolled([5, 3]);
		state.points[2] = { point: 3, color: "black", count: 1 };
		const { result } = await setup(state);
		await act(() => void result.current.liftChecker(8));
		await act(() => void result.current.dropChecker(3));
		expect(played()).toEqual(["checkerLifted", "checkerHit"]);
	});

	it("rejects an illegal drop with a sentence, read out, until the next press", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
		const { result, onPlan } = await setup(rolled([5, 3]));
		await act(() => void result.current.liftChecker(8));
		await act(() => void result.current.dropChecker(1));
		expect(onPlan).not.toHaveBeenCalled();
		expect(result.current.notice).toBe("Point 1 is blocked.");
		expect(announce).toHaveBeenCalledWith("Point 1 is blocked.");
		await act(() => void result.current.liftChecker(8));
		expect(result.current.notice).toBeNull();
		await act(() => void result.current.dropChecker(4));
		expect(result.current.notice).toBe(
			board.moveRejectedReach.replace("{dice}", "5 and 3"),
		);
		await act(() => result.current.tapPoint(13));
		expect(result.current.notice).toBeNull();
		expect(played()).toEqual([
			"checkerLifted",
			"moveRejected",
			"checkerLifted",
			"moveRejected",
			"selectionChanged",
		]);
	});

	it("puts the checker back silently on its own point or off the board", async () => {
		const { result, onPlan } = await setup(rolled([5, 3]));
		for (const target of [8, null] as const) {
			await act(() => void result.current.liftChecker(8));
			let outcome = {};
			await act(() => {
				outcome = result.current.dropChecker(target);
			});
			expect(outcome).toEqual({ kind: "cancel" });
		}
		expect(onPlan).not.toHaveBeenCalled();
		expect(result.current.notice).toBeNull();
		expect(played()).toEqual(["checkerLifted", "checkerLifted"]);
	});

	it("clears a tap selection when a drag starts", async () => {
		const { result } = await setup(rolled([5, 3]));
		await act(() => result.current.tapPoint(13));
		expect(result.current.selected).toBe(13);
		await act(() => void result.current.liftChecker(8));
		await act(() => result.current.cancelDrag());
		expect(result.current.selected).toBeNull();
	});

	it("cancels a drag when the board changes under it", async () => {
		const state = rolled([5, 3]);
		const { result, rerender, onPlan } = await setup(state);
		await act(() => void result.current.liftChecker(8));
		const moved = { ...state, used: [true, false] };
		await rerender({ state: moved, interactive: true });
		expect(result.current.lifted).toBeNull();
		await act(() => void result.current.dropChecker(5));
		expect(onPlan).not.toHaveBeenCalled();
		expect(played()).toEqual(["checkerLifted"]);
	});

	it("cancels a drag when the turn stops being this player's", async () => {
		const { result, rerender } = await setup(rolled([5, 3]));
		await act(() => void result.current.liftChecker(8));
		await rerender({ state: rolled([5, 3]), interactive: false });
		expect(result.current.lifted).toBeNull();
		expect(result.current.draggable).toEqual([]);
	});
});

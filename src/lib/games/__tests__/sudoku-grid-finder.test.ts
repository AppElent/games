// @vitest-environment jsdom
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIND_TIMEOUT_MS, findGridCorners } from "../sudoku-grid-finder";

/** Stands in for the browser's worker; `answer` is what it does with a photo. */
class FakeWorker {
	static made: FakeWorker[] = [];
	static answer: (worker: FakeWorker) => void = () => {};
	onmessage: (event: { data: Point[] | null }) => void = () => {};
	onerror: () => void = () => {};
	posted: unknown;
	terminate = vi.fn();
	constructor() {
		FakeWorker.made.push(this);
	}
	postMessage(request: unknown) {
		this.posted = request;
		FakeWorker.answer(this);
	}
}

function photo(width: number, height: number) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

const find = (signal = new AbortController().signal) =>
	findGridCorners(photo(1400, 700), signal);

describe("findGridCorners", () => {
	beforeEach(() => {
		FakeWorker.made = [];
		FakeWorker.answer = () => {};
		vi.stubGlobal("Worker", FakeWorker);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
			() =>
				({
					drawImage: () => {},
					getImageData: (_x: number, _y: number, w: number, h: number) => ({
						data: new Uint8ClampedArray(w * h * 4),
					}),
				}) as never,
		);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("searches a smaller photo and answers in the photo's own pixels", async () => {
		FakeWorker.answer = (worker) =>
			worker.onmessage({
				data: [
					{ x: 80, y: 40 },
					{ x: 400, y: 40 },
					{ x: 400, y: 360 },
					{ x: 80, y: 360 },
				],
			});
		expect(await find()).toEqual([
			{ x: 140, y: 70 },
			{ x: 700, y: 70 },
			{ x: 700, y: 630 },
			{ x: 140, y: 630 },
		]);
		const [worker] = FakeWorker.made;
		expect(worker.posted).toMatchObject({ width: 800, height: 400 });
		expect(worker.terminate).toHaveBeenCalled();
	});

	it("answers null when the search is unsure", async () => {
		FakeWorker.answer = (worker) => worker.onmessage({ data: null });
		expect(await find()).toBeNull();
	});

	it("answers null when the worker fails or cannot start", async () => {
		FakeWorker.answer = (worker) => worker.onerror();
		expect(await find()).toBeNull();
		vi.stubGlobal("Worker", undefined);
		expect(await find()).toBeNull();
	});

	it("answers null when the photo's pixels cannot be read", async () => {
		vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
		expect(await find()).toBeNull();
	});

	it("gives up after a while, and at once when called off", async () => {
		vi.useFakeTimers();
		const slow = find();
		await vi.advanceTimersByTimeAsync(FIND_TIMEOUT_MS);
		expect(await slow).toBeNull();

		const controller = new AbortController();
		const stopped = find(controller.signal);
		controller.abort();
		expect(await stopped).toBeNull();
		for (const worker of FakeWorker.made) {
			expect(worker.terminate).toHaveBeenCalled();
		}
		expect(vi.getTimerCount()).toBe(0);
	});

	it("starts no search that was called off beforehand", async () => {
		expect(await find(AbortSignal.abort())).toBeNull();
		expect(FakeWorker.made).toEqual([]);
	});
});

/**
 * Reads a sudoku from a photo on the device with Apple Vision (iOS only).
 * Native side: `ios/SudokuScannerModule.swift`.
 *
 * `sudokuScanner` is null where the native module is missing: on Android,
 * and in installed builds from before the module shipped that receive this
 * JavaScript as an update. Callers hide the scan entry then.
 */
import type {
	DigitRead,
	InkBox,
	Point,
} from "@arcadeclub/core/sudoku-scan-ink";
import { NativeModule, requireOptionalNativeModule } from "expo";

/** A photo, upright and scaled down, in the app's caches folder. */
export type PreparedPhoto = { uri: string; width: number; height: number };

/** The straightened grid: a grayscale PNG and its pixels, `size` square. */
export type WarpedGrid = { uri: string; size: number; pixels: Uint8Array };

declare class SudokuScannerModule extends NativeModule {
	prepareImage(uri: string): Promise<PreparedPhoto>;
	/** Corners clockwise from the top-left, or null when no grid stands out. */
	detectGrid(uri: string): Promise<Point[] | null>;
	warpGrid(uri: string, corners: Point[]): Promise<WarpedGrid>;
	/** One read per box of the warped grid image, in order. */
	readDigits(uri: string, boxes: InkBox[]): Promise<DigitRead[]>;
}

export const sudokuScanner =
	requireOptionalNativeModule<SudokuScannerModule>("SudokuScanner");

/**
 * Square test images turned by quarter turns, as a photo taken sideways or
 * upside down shows a grid.
 */

/** A square image turned clockwise by `quarters` quarter turns. */
export function turned<T extends Uint8Array | Uint8ClampedArray>(
	pixels: T,
	size: number,
	channels: number,
	quarters: number,
): T {
	let out = pixels;
	for (let q = 0; q < ((quarters % 4) + 4) % 4; q += 1) {
		const next = new (out.constructor as new (length: number) => T)(out.length);
		for (let y = 0; y < size; y += 1) {
			for (let x = 0; x < size; x += 1) {
				// Clockwise: the old left column becomes the new top row.
				const from = ((size - 1 - x) * size + y) * channels;
				const to = (y * size + x) * channels;
				for (let c = 0; c < channels; c += 1) {
					next[to + c] = out[from + c];
				}
			}
		}
		out = next;
	}
	return out;
}

/**
 * A small convolutional network that reads one digit, printed or handwritten.
 * It runs in plain JavaScript, so it reaches installed builds as an update;
 * `scripts/scan-bench/train` made its weights.
 */
import { DIGIT_NET_WEIGHTS } from "./digit-net-weights";
import { GLYPH } from "./grid-ink";

export type DigitGuess = {
	/** The likeliest of 1-9. */
	digit: number;
	/** How likely `digit` is, from 0 to 1. */
	confidence: number;
	/** How likely the ink is not a digit at all. */
	junk: number;
	/** Above 0 when the digit looks printed, below when handwritten. */
	printScore: number;
};

type Layer = { weights: Float32Array; bias: Float32Array };

/** Each layer's weights are bytes of its largest weight; biases are floats. */
function decodeLayer({ scale, weights, bias }: StoredLayer): Layer {
	const bytes = atob(weights);
	return {
		weights: Float32Array.from(
			{ length: bytes.length },
			(_, i) => (bytes.charCodeAt(i) - 128) * scale,
		),
		bias: Float32Array.from(bias),
	};
}

type StoredLayer = {
	scale: number;
	weights: string;
	bias: readonly number[];
};

let layers: Layer[] | null = null;

/**
 * A convolution with zero padding that keeps the size, then ReLU. Goes by
 * input pixel, not by output pixel: over half of them are 0 and cost nothing.
 */
function convolve(
	input: Float32Array,
	channels: number,
	size: number,
	{ weights, bias }: Layer,
	kernel: number,
): Float32Array {
	const pad = (kernel - 1) / 2;
	const filters = bias.length;
	const area = size * size;
	const stride = channels * kernel * kernel;
	const output = new Float32Array(filters * area);
	for (let filter = 0; filter < filters; filter += 1) {
		output.fill(bias[filter], filter * area, (filter + 1) * area);
	}
	for (let index = 0; index < input.length; index += 1) {
		const value = input[index];
		if (value === 0) continue;
		const channel = Math.floor(index / area);
		const x = index % size;
		const y = Math.floor((index % area) / size);
		for (let ky = 0; ky < kernel; ky += 1) {
			const outY = y - ky + pad;
			if (outY < 0 || outY >= size) continue;
			for (let kx = 0; kx < kernel; kx += 1) {
				const outX = x - kx + pad;
				if (outX < 0 || outX >= size) continue;
				let out = outY * size + outX;
				let weight = (channel * kernel + ky) * kernel + kx;
				for (; weight < weights.length; weight += stride) {
					output[out] += weights[weight] * value;
					out += area;
				}
			}
		}
	}
	for (let i = 0; i < output.length; i += 1) {
		if (output[i] < 0) output[i] = 0;
	}
	return output;
}

/** The largest of every 2 × 2 pixels; an odd last row or column is dropped. */
function pool(input: Float32Array, channels: number, size: number) {
	const half = Math.floor(size / 2);
	const output = new Float32Array(channels * half * half);
	for (let channel = 0; channel < channels; channel += 1) {
		for (let y = 0; y < half; y += 1) {
			for (let x = 0; x < half; x += 1) {
				const at = channel * size * size + y * 2 * size + x * 2;
				output[(channel * half + y) * half + x] = Math.max(
					input[at],
					input[at + 1],
					input[at + size],
					input[at + size + 1],
				);
			}
		}
	}
	return output;
}

function connect(input: Float32Array, { weights, bias }: Layer) {
	return Float32Array.from(bias, (start, unit) => {
		let sum = start;
		for (let i = 0; i < input.length; i += 1) {
			sum += weights[unit * input.length + i] * input[i];
		}
		return sum;
	});
}

/** The digit in a `GLYPH` square image of ink, as `glyphImage` makes it. */
export function guessDigit(image: Float32Array): DigitGuess {
	layers ??= DIGIT_NET_WEIGHTS.map(decodeLayer);
	const [first, second, third, hidden, last] = layers;
	let size = GLYPH;
	let values = pool(
		convolve(image, 1, size, first, 5),
		first.bias.length,
		size,
	);
	size = Math.floor(size / 2);
	values = pool(
		convolve(values, first.bias.length, size, second, 3),
		second.bias.length,
		size,
	);
	size = Math.floor(size / 2);
	values = pool(
		convolve(values, second.bias.length, size, third, 3),
		third.bias.length,
		size,
	);
	const scores = connect(
		connect(values, hidden).map((value) => Math.max(0, value)),
		last,
	);
	const classes = scores.subarray(0, 10);
	const top = Math.max(...classes);
	const odds = classes.map((score) => Math.exp(score - top));
	const total = odds.reduce((sum, value) => sum + value, 0);
	let digit = 1;
	for (let i = 2; i <= 9; i += 1) {
		if (odds[i] > odds[digit]) digit = i;
	}
	return {
		digit,
		confidence: odds[digit] / total,
		junk: odds[0] / total,
		printScore: scores[10],
	};
}

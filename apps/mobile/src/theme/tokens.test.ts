import { readFileSync } from "node:fs";
import { join } from "node:path";
import { darkColors, lightColors, type Tokens } from "./tokens";

type Rgb = readonly [number, number, number];

function parse(color: string, over?: Rgb): Rgb {
	const hex = /^#([0-9a-f]{6})$/i.exec(color);
	if (hex) {
		const n = Number.parseInt(hex[1], 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	const rgba = /^rgba\(([^)]+)\)$/.exec(color);
	if (!rgba || !over) throw new Error(`Cannot resolve ${color}`);
	const [r, g, b, a] = rgba[1].split(",").map(Number);
	return [r, g, b].map((c, i) => c * a + over[i] * (1 - a)) as unknown as Rgb;
}

function luminance([r, g, b]: Rgb): number {
	const channel = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const schemes: [string, Tokens][] = [
	["dark", darkColors],
	["light", lightColors],
];

describe.each(schemes)("%s colour pairs meet WCAG AA", (_name, t) => {
	const bg = parse(t.bg);
	const surface = parse(t.surface);
	const surface2 = parse(t.surface2);

	it.each([
		["bg", bg],
		["surface", surface],
		["surface2", surface2],
	])("textFaint on %s reaches 4.5:1", (_label, ground) => {
		expect(contrast(parse(t.textFaint), ground)).toBeGreaterThanOrEqual(4.5);
	});

	it.each([
		["orange", "orangeDim", "bg", bg],
		["orange", "orangeDim", "surface", surface],
		["accent", "accentDim", "bg", bg],
		["accent", "accentDim", "surface", surface],
	] as const)("%s on %s over %s reaches 4.5:1", (ink, tint, _label, ground) => {
		const fill = parse(t[tint], ground);
		expect(contrast(parse(t[ink]), fill)).toBeGreaterThanOrEqual(4.5);
	});

	it.each([
		["bg", bg],
		["surface", surface],
	])("a borderStrong field border reaches 3:1 against %s", (_label, ground) => {
		const border = parse(t.borderStrong, surface);
		expect(contrast(border, ground)).toBeGreaterThanOrEqual(3);
	});
});

describe("web tokens match the phone's", () => {
	const css = readFileSync(
		join(__dirname, "../../../../src/styles.css"),
		"utf8",
	);
	const block = (selector: string) => {
		const start = css.indexOf(`${selector} {`);
		if (start < 0) throw new Error(`${selector} block not found in styles.css`);
		return css.slice(start, css.indexOf("}", start));
	};
	const value = (selector: string, name: string) =>
		new RegExp(`--${name}:\\s*([^;]+);`).exec(block(selector))?.[1].trim();

	it.each([
		[":root", darkColors],
		[".game-fullscreen", darkColors],
		[".light", lightColors],
	])("%s", (selector, t) => {
		expect(value(selector, "club-soft")).toBe(t.textFaint);
		expect(value(selector, "club-line")).toBe(t.border);
		expect(value(selector, "club-line-strong")).toBe(t.borderStrong);
		expect(value(selector, "club-orange")).toBe(t.orange);
	});
});

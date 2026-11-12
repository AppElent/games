import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardColors, darkColors, lightColors, type Tokens } from "./tokens";

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
	const surfacePressed = parse(t.surfacePressed);

	it.each([
		["bg", bg],
		["surface", surface],
		["surface2", surface2],
		["surfacePressed", surfacePressed],
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

const repoFile = (path: string) =>
	readFileSync(join(__dirname, "../../../..", path), "utf8");

/** A border drawn over a control's fill, against the ground around it. */
function borderContrast(line: string, fill: string, ground: Rgb): number {
	return contrast(parse(line, parse(fill, ground)), ground);
}

describe("card table controls reach 3:1 on the felt", () => {
	const felts = Object.entries(cardColors.felts).map(
		([name, [brightest]]) => [name, parse(brightest)] as const,
	);
	const css = repoFile("src/components/cards/cards.css");
	const value = (selector: string, property: string) => {
		const start = css.indexOf(`${selector} {`);
		if (start < 0) throw new Error(`${selector} block not found in cards.css`);
		const block = css.slice(start, css.indexOf("}", start));
		return new RegExp(`\\s${property}:\\s*([^;]+);`).exec(block)?.[1].trim();
	};

	it.each(felts)("ivoryLine over a chip on %s", (_name, felt) => {
		expect(
			borderContrast(cardColors.ivoryLine, cardColors.chip, felt),
		).toBeGreaterThanOrEqual(3);
	});

	it("ivoryLine over a chip on the result panel", () => {
		expect(
			borderContrast(
				cardColors.ivoryLine,
				cardColors.chip,
				parse(cardColors.panel),
			),
		).toBeGreaterThanOrEqual(3);
	});

	// The web's icon chip has the darkest fill of any control on the felt.
	it.each(felts)("the web icon chip's border on %s", (_name, felt) => {
		const fill = value(".icon-chip", "background");
		if (!fill) throw new Error("no .icon-chip background in cards.css");
		expect(
			borderContrast(cardColors.ivoryLine, fill, felt),
		).toBeGreaterThanOrEqual(3);
	});

	it("the web table carries the same line and felts", () => {
		expect(value(".cards-felt", "--ivory-line")).toBe(cardColors.ivoryLine);
		expect(value(".cards-felt", "--felt-a")).toBe(cardColors.felts.oxblood[0]);
		expect(value('.cards-felt[data-felt="bottle"]', "--felt-a")).toBe(
			cardColors.felts.bottle[0],
		);
		expect(value('.cards-felt[data-felt="midnight"]', "--felt-a")).toBe(
			cardColors.felts.midnight[0],
		);
	});
});

describe("web backgammon controls reach 3:1", () => {
	const line = /const CONTROL_LINE = "([^"]+)";/.exec(
		repoFile("src/components/backgammon/BackgammonBoard.tsx"),
	)?.[1];
	if (!line) throw new Error("CONTROL_LINE not found in BackgammonBoard.tsx");

	// Buttons sit on the fullscreen stage (bg-slate-950); the off switch sits in
	// the options panel, whose gradient starts at #2c2018.
	it.each([
		["a ghost button on the stage", "rgba(255, 255, 255, 0.05)", "#020617"],
		["the reset button on the stage", "rgba(0, 0, 0, 0)", "#020617"],
		[
			"an off switch in the options panel",
			"rgba(255, 255, 255, 0.12)",
			"#2c2018",
		],
	])("%s", (_label, fill, ground) => {
		expect(borderContrast(line, fill, parse(ground))).toBeGreaterThanOrEqual(3);
	});
});

describe("web header", () => {
	// Header.tsx: bg-slate-950/72 over the page. A white page is the worst case.
	const bar = parse("rgba(2, 6, 23, 0.72)", parse("#ffffff"));
	const css = readFileSync(
		join(__dirname, "../../../../src/styles.css"),
		"utf8",
	);

	it("nav links (and Sign in) reach 4.5:1 on the bar over a light page", () => {
		const color = /\.club-nav-link \{[^}]*color:\s*(#[0-9a-f]{6});/i.exec(
			css,
		)?.[1];
		if (!color) throw new Error(".club-nav-link color not found");
		expect(contrast(parse(color), bar)).toBeGreaterThanOrEqual(4.5);
	});

	it("white/60 button borders reach 3:1 against the button's white/10 fill", () => {
		const fill = parse("rgba(255, 255, 255, 0.1)", bar);
		const border = parse("rgba(255, 255, 255, 0.6)", fill);
		expect(contrast(border, fill)).toBeGreaterThanOrEqual(3);
	});
});

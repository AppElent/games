import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	cardColors,
	darkColors,
	lightColors,
	markerColors,
	type Tokens,
} from "./tokens";

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

	// An empty selected Sudoku cell in a note mode: notes on accentTint over
	// accentDim, and the tint still visibly deeper than the plain fill.
	it("textMuted notes on accentTint over accentDim reach 4.5:1", () => {
		const fill = parse(t.accentTint, parse(t.accentDim, surface));
		expect(contrast(parse(t.textMuted), fill)).toBeGreaterThanOrEqual(4.5);
	});

	it("accentTint over accentDim stands out from accentDim alone", () => {
		const plain = parse(t.accentDim, surface);
		const tinted = parse(t.accentTint, plain);
		expect(contrast(tinted, plain)).toBeGreaterThanOrEqual(1.2);
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

	// The web's icon chip has the darkest fill of any control on the felt; the
	// seat menu button (`.seat-manage`) is one, and the phone's `manage` button
	// is the `chip` fill tested above.
	describe.each([".icon-chip", ".seat-manage"])("the web %s", (selector) => {
		it.each(felts)("border on %s", (_name, felt) => {
			const fill = value(selector, "background");
			if (!fill) throw new Error(`no ${selector} background in cards.css`);
			expect(value(selector, "border")).toContain("var(--ivory-line)");
			expect(
				borderContrast(cardColors.ivoryLine, fill, felt),
			).toBeGreaterThanOrEqual(3);
		});
	});

	it("the phone's seat menu button has the ivoryLine border", () => {
		const source = repoFile(
			"apps/mobile/src/features/cards/table/seat-row.tsx",
		);
		const manage = source.slice(source.indexOf("manage: {"));
		expect(manage.slice(0, manage.indexOf("},"))).toContain(
			"borderColor: cardColors.ivoryLine",
		);
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
		["the turn badge, white to move", "rgba(247, 238, 214, 0.14)", "#020617"],
		["the turn badge, black to move", "rgba(20, 16, 12, 0.5)", "#020617"],
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

describe("web puzzle boards", () => {
	// Sudoku and binary cells are tap targets, so thin cell lines use the phone's
	// borderStrong. The boards keep their own themed ground inside the fullscreen
	// shell, so they read --puzzle-line; the scan board is always dark and reads
	// the pinned --club-line-strong.
	const styles = readFileSync(
		join(__dirname, "../../../../src/styles.css"),
		"utf8",
	);
	const sudoku = (file: string) =>
		readFileSync(
			join(__dirname, "../../../../src/components/sudoku", file),
			"utf8",
		);
	const line = (selector: string) =>
		new RegExp(
			`${selector.replaceAll(".", "\\.")} \\{\\s*--puzzle-line:\\s*([^;]+);`,
		).exec(styles)?.[1];

	it.each([
		[".puzzle-board", lightColors, "#ffffff"],
		[".dark .puzzle-board", darkColors, "#0f172a"],
	] as const)(
		"%s thin lines are the phone's borderStrong, 3:1 on the board",
		(selector, t, board) => {
			expect(line(selector)).toBe(t.borderStrong);
			const ground = parse(board);
			expect(
				contrast(parse(t.borderStrong, ground), ground),
			).toBeGreaterThanOrEqual(3);
		},
	);

	// Thin lines are the 1px border strings: `"border-l border-l-<colour>"` on the
	// Sudoku grids, and every border colour in the binary cell's class template.
	// The whole string must be the variable, so a `dark:` override fails too.
	const thinColours = (source: string) => [
		...[...source.matchAll(/"border-([lt]) border-\1-([^"]+)"/g)].map(
			(m) => m[2],
		),
		...[...source.matchAll(/className=\{`[^`]*\bp-0\b[^`]*`\}/g)].flatMap((m) =>
			[...m[0].matchAll(/(?:^|\s|:)border-(?![lrtb]\b|\d)([^\s"`$]+)/g)].map(
				(c) => c[1],
			),
		),
	];

	it.each([
		["SudokuBoard.tsx", "[var(--puzzle-line)]"],
		["BinaryGame.tsx", "[var(--puzzle-line)]"],
		["SudokuScanFlow.tsx", "[var(--club-line-strong)]"],
	])("every thin line in %s is %s", (file, colour) => {
		const source = sudoku(file);
		const found = thinColours(source);
		expect(found.length).toBeGreaterThan(0);
		for (const c of found) expect(c).toBe(colour);
		if (colour.includes("puzzle-line")) {
			expect(source).toContain("puzzle-board ");
		}
	});
});

describe("web field and error utilities (club-field, club-error)", () => {
	const css = repoFile("src/styles.css");
	const utility = (name: string) => {
		const start = css.indexOf(`@utility ${name} {`);
		if (start < 0) throw new Error(`@utility ${name} not found in styles.css`);
		return css.slice(start, css.indexOf("}", start));
	};
	const tokens = (selector: string) => {
		const start = css.indexOf(`${selector} {`);
		const block = css.slice(start, css.indexOf("}", start));
		return (name: string) => {
			const found = new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1];
			if (!found) throw new Error(`--${name} missing in ${selector}`);
			return found.trim();
		};
	};

	// A fixed palette colour in either utility would be right on one theme only,
	// which is how the dark-only `club-input-dark` and `club-error` slipped onto
	// light pages. Colours come from --club-* variables, so each theme (and the
	// pinned-dark game screens) resolves its own.
	it.each([
		"club-field",
		"club-error",
		"club-panel-heading",
		"club-field-label",
	])("%s only uses --club-* colours", (name) => {
		const apply = /@apply ([^;]+);/.exec(utility(name))?.[1] ?? "";
		const colours = apply
			.split(/\s+/)
			.filter((c) => /(^|:)(bg|text|border|placeholder|outline|ring)-/.test(c))
			.filter((c) => !/-(none|px|sm|xs|md|lg|xl|\d+)$/.test(c));
		expect(colours.length).toBeGreaterThan(0);
		for (const c of colours) expect(c).toContain("var(--club-");
	});

	it("no component brings back the dark-only field, or hand-writes a field or button border", () => {
		const files: string[] = execFileSync("git", ["ls-files", "src/**/*.tsx"], {
			cwd: join(__dirname, "../../../.."),
			encoding: "utf8",
		})
			.split("\n")
			.filter(Boolean);
		expect(files.length).toBeGreaterThan(50);
		const offenders = files.filter((file) => {
			const source = repoFile(file);
			return (
				source.includes("club-input-dark") ||
				// `club-field` and `club-btn-outline` own this edge.
				source.includes("border border-[var(--club-line-strong)]")
			);
		});
		expect(offenders).toEqual([]);
	});

	const pages = [
		["light", ".light", ["#ffffff", "#eef2ff"]],
		["dark", ":root", ["#080a12", "#111827"]],
		["game screen", ".game-fullscreen", ["#020617"]],
	] as const;

	describe.each(pages)("%s", (_label, selector, grounds) => {
		// :root holds the dark defaults, .light and .game-fullscreen override.
		const read = (name: string) => {
			try {
				return tokens(selector)(name);
			} catch {
				return tokens(":root")(name);
			}
		};
		it.each(grounds)("club-field on a %s page", (hex) => {
			const ground = parse(hex);
			const fill = parse(read("club-panel-strong"), ground);
			expect(contrast(parse(read("club-text")), fill)).toBeGreaterThanOrEqual(
				4.5,
			);
			expect(contrast(parse(read("club-soft")), fill)).toBeGreaterThanOrEqual(
				4.5,
			);
			expect(
				borderContrast(
					read("club-line-strong"),
					read("club-panel-strong"),
					ground,
				),
			).toBeGreaterThanOrEqual(3);
			expect(
				borderContrast(read("club-cyan"), read("club-panel-strong"), ground),
			).toBeGreaterThanOrEqual(3);
		});

		it.each(grounds)("club-error on a %s page", (hex) => {
			const ground = parse(hex);
			expect(
				contrast(parse(read("club-orange")), ground),
			).toBeGreaterThanOrEqual(4.5);
		});
	});
});

describe("filled puzzle cells carry a 3:1 edge", () => {
	// The grid line beside a hinted, same-digit, selected or colour-marked cell
	// is about 2:1 against its fill in dark mode, so those cells draw their own
	// 1px ring in the box-line colour.
	it.each(schemes)("the phone's ring on %s fills", (_name, t) => {
		const ground = parse(t.surface);
		const fills = [t.accentDim, t.orangeDim, ...markerColors.map((m) => m)].map(
			(f) => parse(f, ground),
		);
		for (const fill of fills) {
			expect(contrast(parse(t.text), fill)).toBeGreaterThanOrEqual(3);
		}
	});

	// SudokuBoard.tsx: tints are Tailwind -500 at /40, selected sky-300/60 and
	// sky-400/30, hint amber-300/50 and /25, same digit sky-400/25 and sky-500/20.
	const tw = {
		sky300: "#7dd3fc",
		sky400: "#38bdf8",
		sky500: "#0ea5e9",
		amber300: "#fcd34d",
		amber500: "#f59e0b",
		emerald500: "#10b981",
		rose500: "#f43f5e",
		violet500: "#8b5cf6",
		teal500: "#14b8a6",
		orange500: "#f97316",
		pink500: "#ec4899",
	};
	const tint = (name: keyof typeof tw, alpha: number, ground: Rgb): Rgb => {
		const [r, g, b] = parse(tw[name]);
		return parse(`rgba(${r}, ${g}, ${b}, ${alpha})`, ground);
	};
	const colourTints = [
		"sky500",
		"emerald500",
		"amber500",
		"rose500",
		"violet500",
		"teal500",
		"orange500",
		"pink500",
	] as const;

	it("the web board's classes are the ones tested here", () => {
		const source = readFileSync(
			join(__dirname, "../../../../src/components/sudoku/SudokuBoard.tsx"),
			"utf8",
		);
		expect(source).toContain("inset-ring-1 inset-ring-slate-600");
		expect(source).toContain("dark:inset-ring-slate-300/70");
		for (const c of [
			"sky-300/60",
			"sky-400/30",
			"amber-300/50",
			"amber-300/25",
		])
			expect(source).toContain(c);
		for (const c of colourTints)
			expect(source).toContain(`bg-${c.replace(/(\d+)/, "-$1")}/40`);
	});

	// [selected, hint, same digit] as [colour, alpha], per theme.
	const themes = [
		[
			"light",
			"#ffffff",
			"#475569",
			[
				["sky300", 0.6],
				["amber300", 0.5],
				["sky400", 0.25],
			],
		],
		[
			"dark",
			"#0f172a",
			"rgba(203, 213, 225, 0.7)",
			[
				["sky400", 0.3],
				["amber300", 0.25],
				["sky500", 0.2],
			],
		],
	] as const;

	it.each(themes)(
		"the web board's ring on %s fills",
		(_name, board, ring, states) => {
			const ground = parse(board);
			const fills = [
				...states.map(([name, alpha]) => tint(name, alpha, ground)),
				...colourTints.map((name) => tint(name, 0.4, ground)),
			];
			for (const fill of fills) {
				expect(contrast(parse(ring, fill), fill)).toBeGreaterThanOrEqual(3);
			}
		},
	);
});

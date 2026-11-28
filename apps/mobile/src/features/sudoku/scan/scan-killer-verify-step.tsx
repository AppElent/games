/**
 * Check a Killer read from a photo before playing, as the web's Killer check
 * does: the cages drawn from the dashes found, the sums read in their
 * corners, and the lines and sums the read was unsure of in amber. Tapping a cell
 * shows its cage's sum to correct and the four lines around it to draw or
 * remove. The puzzle starts once the sums add up to 405 and its cages allow
 * exactly one solution.
 */
import {
	type CageEdge,
	checkKillerScan,
	edgeBetween,
	edgeKey,
	type KillerScan,
	type KillerScanCheck,
	killerScanCages,
	parseCageSum,
	setKillerSum,
	toggleKillerBorder,
} from "@arcadeclub/core/sudoku-scan-cages";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Image,
	Keyboard,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import Svg, { Line } from "react-native-svg";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	metrics,
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";

type Props = {
	gridUri: string;
	scan: KillerScan;
	onChange: (scan: KillerScan) => void;
	onStartOver: () => void;
	/** For a classic grid the cage read mistook for a Killer. */
	onReadAsClassic: () => void;
	onConfirm: () => void;
	error: string | null;
};

type Direction = "up" | "right" | "down" | "left";

/** The grid's largest side, so it stays a comfortable size on a tablet. */
const MAX_GRID = 440;
const BORDER = 2;
const LINES = Array.from({ length: 8 }, (_, i) => i + 1);
/** How far cage lines sit inside a cell edge, as a share of the cell. */
const CAGE_INSET = 0.08;

/** The neighbour of `cell` in `direction`, or null at the grid's edge. */
function neighbor(cell: number, direction: Direction) {
	const row = Math.floor(cell / 9);
	const col = cell % 9;
	switch (direction) {
		case "up":
			return row > 0 ? cell - 9 : null;
		case "down":
			return row < 8 ? cell + 9 : null;
		case "left":
			return col > 0 ? cell - 1 : null;
		case "right":
			return col < 8 ? cell + 1 : null;
	}
}

/** The edge between `cell` and its neighbour in `direction`, if any. */
function edgeToward(cell: number, direction: Direction): CageEdge | null {
	const other = neighbor(cell, direction);
	return other === null ? null : edgeBetween(cell, other);
}

export function ScanKillerVerifyStep({
	gridUri,
	scan,
	onChange,
	onStartOver,
	onReadAsClassic,
	onConfirm,
	error,
}: Props) {
	const styles = useThemedStyles(createStyles);
	const tokens = useTokens();
	const { t, locale } = useI18n();
	const copy = t.games.sudoku.scan;
	const killer = copy.killer;
	const { width } = useWindowDimensions();
	const size = Math.min(width - metrics.screenGutter * 2, MAX_GRID);
	const inner = size - BORDER * 2;
	const cellSize = inner / 9;

	const cages = useMemo(() => killerScanCages(scan), [scan]);
	const cageOf = useMemo(() => {
		const byCell = new Array<number>(81).fill(-1);
		cages.forEach((cage, index) => {
			for (const cell of cage.cells) byCell[cell] = index;
		});
		return byCell;
	}, [cages]);
	const doubtful = useMemo(() => new Set(scan.doubtful), [scan.doubtful]);
	const borders = useMemo(() => new Set(scan.borders), [scan.borders]);
	const unsureSums = useMemo(
		() => new Set(scan.unsureSums ?? []),
		[scan.unsureSums],
	);
	const quickCheck = useMemo(
		() => checkKillerScan(scan, { checkUnique: false }),
		[scan],
	);
	// Counting solutions takes about a second, so it runs on confirm only.
	const [confirmCheck, setConfirmCheck] = useState<{
		scan: KillerScan;
		check: KillerScanCheck;
	} | null>(null);
	const check =
		quickCheck ?? (confirmCheck?.scan === scan ? confirmCheck.check : null);

	const [selected, setSelected] = useState(() => {
		const missing = cages.find((cage) => cage.sum === null);
		if (missing) return missing.cells[0];
		const unsureSum = scan.unsureSums?.[0];
		if (unsureSum !== undefined) return unsureSum;
		const unsure = scan.doubtful[0];
		return unsure ? Number.parseInt(unsure, 10) : 0;
	});
	const cage = cages[cageOf[selected]];
	const [sumText, setSumText] = useState(
		cage?.sum != null ? String(cage.sum) : "",
	);
	// The field shows the selected cage's sum; it follows a new selection.
	const cageKey = cage?.cells[0];
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when another cage is picked
	useEffect(() => {
		setSumText(cage?.sum != null ? String(cage.sum) : "");
	}, [cageKey]);
	const sumValid = sumText.trim() === "" || parseCageSum(sumText) !== null;

	function changeSum(text: string) {
		setSumText(text);
		if (text.trim() === "") {
			onChange(setKillerSum(scan, selected, null));
			return;
		}
		const sum = parseCageSum(text);
		if (sum !== null) onChange(setKillerSum(scan, selected, sum));
	}

	function toggleLine(edge: CageEdge) {
		Keyboard.dismiss();
		haptics.selectionChanged();
		onChange(toggleKillerBorder(scan, edge));
	}

	// Counting solutions blocks the JavaScript thread for a second or more:
	// the button shows it is busy first, and a second tap does nothing.
	const [checking, setChecking] = useState(false);
	const checkingRef = useRef(false);
	function confirm() {
		if (checkingRef.current) return;
		Keyboard.dismiss();
		checkingRef.current = true;
		setChecking(true);
		setTimeout(() => {
			const full = checkKillerScan(scan);
			checkingRef.current = false;
			setChecking(false);
			if (full) {
				haptics.actionFailed();
				setConfirmCheck({ scan, check: full });
				return;
			}
			onConfirm();
		}, 0);
	}

	function describeCheck(entry: KillerScanCheck) {
		switch (entry.kind) {
			case "missingSums":
				return plural(locale, entry.count, killer.missingSums);
			case "total":
				return fmt(killer.total, { total: entry.total });
			case "notUnique":
				return entry.solutions === 0 ? killer.noSolution : killer.manySolutions;
			case "invalidCages":
				return killer.invalidCages;
		}
	}

	function cellName(cell: number) {
		const entry = cages[cageOf[cell]];
		const name =
			entry?.sum == null
				? killer.cellNameNoSum
				: unsureSums.has(entry.cells[0])
					? killer.cellNameUnsure
					: killer.cellName;
		return fmt(name, {
			row: Math.floor(cell / 9) + 1,
			col: (cell % 9) + 1,
			count: entry?.cells.length ?? 1,
			sum: entry?.sum ?? 0,
		});
	}

	// Cage lines sit inside each cell, on the sides where the cage ends.
	const cageLines = useMemo(() => {
		const segments: [number, number, number, number][] = [];
		for (let cell = 0; cell < 81; cell += 1) {
			const row = Math.floor(cell / 9);
			const col = cell % 9;
			const ends = (direction: Direction) => {
				const other = neighbor(cell, direction);
				return other === null || cageOf[other] !== cageOf[cell];
			};
			const top = ends("up");
			const bottom = ends("down");
			const left = ends("left");
			const right = ends("right");
			const x0 = col + (left ? CAGE_INSET : 0);
			const x1 = col + 1 - (right ? CAGE_INSET : 0);
			const y0 = row + (top ? CAGE_INSET : 0);
			const y1 = row + 1 - (bottom ? CAGE_INSET : 0);
			if (top) segments.push([x0, row + CAGE_INSET, x1, row + CAGE_INSET]);
			if (bottom)
				segments.push([x0, row + 1 - CAGE_INSET, x1, row + 1 - CAGE_INSET]);
			if (left) segments.push([col + CAGE_INSET, y0, col + CAGE_INSET, y1]);
			if (right)
				segments.push([col + 1 - CAGE_INSET, y0, col + 1 - CAGE_INSET, y1]);
		}
		return segments;
	}, [cageOf]);

	// An unsure line is marked on the cell edge it was read on.
	const unsureLines = scan.doubtful.map((key) => {
		const cell = Number.parseInt(key, 10);
		const row = Math.floor(cell / 9);
		const col = cell % 9;
		return key.endsWith("r")
			? { key, x1: col + 1, y1: row + 0.1, x2: col + 1, y2: row + 0.9 }
			: { key, x1: col + 0.1, y1: row + 1, x2: col + 0.9, y2: row + 1 };
	});

	const lineButtons: { direction: Direction; label: string }[] = [
		{ direction: "up", label: killer.lineUp },
		{ direction: "right", label: killer.lineRight },
		{ direction: "down", label: killer.lineDown },
		{ direction: "left", label: killer.lineLeft },
	];

	return (
		<>
			<View style={styles.group}>
				<AppText variant="label" accessibilityRole="header">
					{killer.gridLabel.toUpperCase()}
				</AppText>
				<View style={[styles.board, { width: size, height: size }]}>
					{Array.from({ length: 81 }, (_, cell) => {
						const row = Math.floor(cell / 9);
						const col = cell % 9;
						const entry = cages[cageOf[cell]];
						const first = entry?.cells[0] === cell;
						const sumUnsure = entry?.sum != null && unsureSums.has(cell);
						return (
							<Pressable
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed 81-cell grid
								key={cell}
								accessibilityRole="button"
								accessibilityLabel={cellName(cell)}
								accessibilityState={{ selected: selected === cell }}
								onPress={() => {
									// The number pad has no return key: picking a cell closes it.
									Keyboard.dismiss();
									haptics.selectionChanged();
									setSelected(cell);
								}}
								testID={`killer-cell-${cell}`}
								style={[
									styles.cell,
									{
										left: col * cellSize,
										top: row * cellSize,
										width: cellSize,
										height: cellSize,
									},
									cageOf[cell] === cageOf[selected] && styles.inCage,
									selected === cell && styles.selected,
								]}
							>
								{first ? (
									<View
										style={[
											styles.sum,
											entry?.sum == null && styles.sumMissing,
											sumUnsure && styles.sumUnsure,
										]}
									>
										<AppText
											variant="cellNote"
											allowFontScaling={false}
											style={[
												styles.sumText,
												{
													color:
														entry?.sum == null
															? tokens.onAmberMark
															: tokens.text,
												},
											]}
										>
											{entry?.sum ?? "?"}
										</AppText>
									</View>
								) : null}
							</Pressable>
						);
					})}
					<Svg
						width={inner}
						height={inner}
						viewBox="0 0 9 9"
						style={StyleSheet.absoluteFill}
						pointerEvents="none"
					>
						{LINES.map((i) => {
							const thick = i % 3 === 0;
							const stroke = thick ? tokens.textMuted : tokens.borderStrong;
							const strokeWidth = thick ? 0.045 : 0.018;
							return [
								<Line
									key={`v${i}`}
									x1={i}
									y1={0}
									x2={i}
									y2={9}
									stroke={stroke}
									strokeWidth={strokeWidth}
								/>,
								<Line
									key={`h${i}`}
									x1={0}
									y1={i}
									x2={9}
									y2={i}
									stroke={stroke}
									strokeWidth={strokeWidth}
								/>,
							];
						})}
						{cageLines.map(([x1, y1, x2, y2], index) => (
							<Line
								// biome-ignore lint/suspicious/noArrayIndexKey: derived per render
								key={`c${index}`}
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								stroke={tokens.text}
								strokeWidth={0.025}
								strokeDasharray="0.07 0.05"
							/>
						))}
						{unsureLines.map((line) => (
							<Line
								key={`u${line.key}`}
								x1={line.x1}
								y1={line.y1}
								x2={line.x2}
								y2={line.y2}
								stroke={tokens.amberMark}
								strokeWidth={0.1}
								strokeLinecap="round"
							/>
						))}
					</Svg>
				</View>
				<View style={styles.summary}>
					<Image
						source={{ uri: gridUri }}
						style={styles.thumbnail}
						accessibilityLabel={copy.correctedGridAlt}
						accessibilityIgnoresInvertColors
					/>
					<View style={styles.grow}>
						<AppText variant="secondary">
							{scan.doubtful.length > 0
								? plural(locale, scan.doubtful.length, killer.unsureLines)
								: killer.allLinesSure}
						</AppText>
						{unsureSums.size > 0 ? (
							<AppText variant="secondary">
								{plural(locale, unsureSums.size, killer.unsureSums)}
							</AppText>
						) : null}
					</View>
				</View>
			</View>
			{cage ? (
				<Card>
					<View style={styles.editor}>
						<View style={styles.header}>
							<AppText variant="heading" accessibilityRole="header">
								{fmt(copy.cellLabel, {
									row: Math.floor(selected / 9) + 1,
									col: (selected % 9) + 1,
								})}
							</AppText>
							<AppText variant="secondary">
								{plural(locale, cage.cells.length, killer.cageLabel)}
							</AppText>
						</View>
						<TextField
							label={killer.sumLabel}
							hint={killer.sumHint}
							value={sumText}
							onChangeText={changeSum}
							keyboardType="number-pad"
							returnKeyType="done"
							maxLength={2}
							style={!sumValid && { borderColor: tokens.danger }}
							testID="killer-sum"
						/>
						<AppText variant="label">{killer.linesLabel.toUpperCase()}</AppText>
						<View style={styles.chips}>
							{lineButtons.map(({ direction, label }) => {
								const edge = edgeToward(selected, direction);
								// The grid's own edge is always a cage line: nothing to toggle.
								if (!edge) return null;
								const key = edgeKey(edge);
								const on = borders.has(key);
								return (
									<Pressable
										key={direction}
										accessibilityRole="switch"
										accessibilityState={{ checked: on }}
										onPress={() => toggleLine(edge)}
										testID={`killer-line-${direction}`}
										style={({ pressed }) => [
											styles.chip,
											on && styles.chipOn,
											pressed && { opacity: opacity.pressed },
										]}
									>
										<AppText
											variant="secondary"
											style={{ color: on ? tokens.onAccent : tokens.text }}
										>
											{label}
										</AppText>
										{doubtful.has(key) ? (
											<View style={styles.unsure}>
												<AppText
													variant="caption"
													style={{ color: tokens.amber }}
												>
													{killer.unsure}
												</AppText>
											</View>
										) : null}
									</Pressable>
								);
							})}
						</View>
					</View>
				</Card>
			) : null}
			<View style={styles.group}>
				<Notice message={check ? describeCheck(check) : null} />
				<Notice tone="info" message={check ? null : killer.ready} />
				<Notice message={error} />
				<Button
					label={copy.confirmAndPlay}
					onPress={confirm}
					disabled={check !== null}
					busy={checking}
					testID="killer-confirm"
				/>
				<Button
					label={copy.startOver}
					variant="secondary"
					onPress={onStartOver}
				/>
				<Button
					label={killer.readAsClassic}
					variant="plain"
					onPress={onReadAsClassic}
					testID="killer-read-as-classic"
				/>
			</View>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		group: { gap: spacing.md },
		board: {
			alignSelf: "center",
			borderRadius: radius.sm,
			borderWidth: BORDER,
			borderColor: colors.textMuted,
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		cell: { position: "absolute" },
		inCage: { backgroundColor: colors.accentDim },
		selected: { borderWidth: 2, borderColor: colors.accent },
		sum: {
			position: "absolute",
			top: 2,
			left: 3,
			paddingHorizontal: 2,
			borderRadius: 3,
		},
		sumMissing: { backgroundColor: colors.amberMark },
		sumUnsure: {
			borderWidth: 2,
			borderColor: colors.amberMark,
			paddingHorizontal: 1,
		},
		sumText: { fontWeight: "700" },
		summary: { flexDirection: "row", alignItems: "center", gap: spacing.md },
		thumbnail: {
			width: 72,
			height: 72,
			borderRadius: radius.sm,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
		},
		grow: { flex: 1 },
		editor: { gap: spacing.md },
		header: {
			flexDirection: "row",
			alignItems: "baseline",
			flexWrap: "wrap",
			gap: spacing.sm,
		},
		chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
		chip: {
			minHeight: metrics.hitTarget,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.xs,
			paddingHorizontal: spacing.md,
			borderRadius: radius.pill,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
			backgroundColor: colors.surface2,
		},
		chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
		unsure: {
			paddingHorizontal: spacing.xs,
			borderRadius: radius.pill,
			backgroundColor: colors.amberDim,
		},
	});

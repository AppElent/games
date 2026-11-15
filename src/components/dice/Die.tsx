import type { CSSProperties } from "react";

/** Pip centres on a 3x3 grid, per face. */
const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
	1: [[1, 1]],
	2: [
		[0, 0],
		[2, 2],
	],
	3: [
		[0, 0],
		[1, 1],
		[2, 2],
	],
	4: [
		[0, 0],
		[2, 0],
		[0, 2],
		[2, 2],
	],
	5: [
		[0, 0],
		[2, 0],
		[1, 1],
		[0, 2],
		[2, 2],
	],
	6: [
		[0, 0],
		[2, 0],
		[0, 1],
		[2, 1],
		[0, 2],
		[2, 2],
	],
};

/** One die face, drawn; whoever places it names it for screen readers. */
export function DieFace({
	value,
	style,
}: {
	value: number;
	style?: CSSProperties;
}) {
	return (
		<svg
			className="die-face"
			viewBox="0 0 100 100"
			aria-hidden="true"
			style={style}
		>
			<rect x="3" y="3" width="94" height="94" rx="20" className="die-body" />
			{(PIPS[value] ?? []).map(([column, row]) => (
				<circle
					key={`${column}-${row}`}
					cx={24 + column * 26}
					cy={24 + row * 26}
					r="9"
					className="die-pip"
				/>
			))}
		</svg>
	);
}

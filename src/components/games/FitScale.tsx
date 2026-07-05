import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/** Small-screen portrait nudge for games that play best in landscape. */
export function RotateHint() {
	return (
		<p className="pointer-events-none block px-4 pb-2 text-center text-xs text-slate-400 landscape:hidden sm:hidden">
			Rotate your phone for a bigger board
		</p>
	);
}

type FitScaleProps = {
	/** Fixed pixel width the content is designed for (content renders at this width, then scales). */
	designWidth: number;
	children: ReactNode;
	/** Never scale beyond this (default 1 — shrink only, keep native size on big screens). */
	maxScale?: number;
	className?: string;
};

/**
 * Fits fixed-pixel content (game boards) inside the available space with a CSS
 * transform scale — no page scrolling, works in any orientation. The content is
 * rendered at `designWidth`, measured, and scaled down to fit both axes.
 */
export function FitScale({
	designWidth,
	children,
	maxScale = 1,
	className,
}: FitScaleProps) {
	const outerRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);
	const [contentHeight, setContentHeight] = useState(0);

	useLayoutEffect(() => {
		const outer = outerRef.current;
		const inner = innerRef.current;
		if (!outer || !inner) {
			return;
		}
		const update = () => {
			const naturalHeight = inner.offsetHeight;
			const next = Math.min(
				maxScale,
				outer.clientWidth / designWidth,
				naturalHeight > 0 ? outer.clientHeight / naturalHeight : maxScale,
			);
			setScale(next);
			setContentHeight(naturalHeight);
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(outer);
		observer.observe(inner);
		return () => observer.disconnect();
	}, [designWidth, maxScale]);

	return (
		<div
			ref={outerRef}
			className={`flex h-full w-full items-center justify-center overflow-hidden ${className ?? ""}`}
		>
			<div
				style={{ width: designWidth * scale, height: contentHeight * scale }}
			>
				<div
					ref={innerRef}
					style={{
						width: designWidth,
						transform: `scale(${scale})`,
						transformOrigin: "top left",
					}}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

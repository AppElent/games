import { useEffect, useRef } from "react";
import {
	type Gate,
	initialState,
	isTerminal,
	type Level,
	type SimState,
	stepSimulation,
} from "#/lib/games/squad-surge";

/** Track distance visible ahead of the squad. */
const VIEW_DIST = 90;
/** Horizontal track margin as a fraction of canvas width. */
const TRACK_MARGIN = 0.1;
/** Max dt per frame so tab switches don't tunnel through gates. */
const MAX_DT = 1 / 30;

type SquadSurgeCanvasProps = {
	level: Level;
	paused: boolean;
	onEnd: (state: SimState) => void;
};

function clamp01(value: number) {
	return Math.min(1, Math.max(0, value));
}

function gateLabel(gate: Gate) {
	switch (gate.op) {
		case "mul":
			return `×${gate.value}`;
		case "add":
			return `+${gate.value}`;
		case "sub":
			return `−${gate.value}`;
	}
}

function gateIsGood(gate: Gate) {
	return gate.op !== "sub";
}

function draw(
	ctx: CanvasRenderingContext2D,
	cw: number,
	ch: number,
	level: Level,
	state: SimState,
) {
	ctx.clearRect(0, 0, cw, ch);

	const bg = ctx.createLinearGradient(0, 0, 0, ch);
	bg.addColorStop(0, "#0b1020");
	bg.addColorStop(1, "#141a30");
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, cw, ch);

	const x0 = cw * TRACK_MARGIN;
	const x1 = cw * (1 - TRACK_MARGIN);
	const mid = (x0 + x1) / 2;
	const squadY = ch * 0.78;
	const topY = ch * 0.1;
	const pxPerZ = (squadY - topY) / VIEW_DIST;
	const yForZ = (z: number) => squadY - (z - state.z) * pxPerZ;
	const laneToX = (lane: number) => x0 + lane * (x1 - x0);

	// Track surface + center divider.
	ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
	ctx.fillRect(x0, 0, x1 - x0, ch);
	ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
	ctx.setLineDash([10, 14]);
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(mid, 0);
	ctx.lineTo(mid, ch);
	ctx.stroke();
	ctx.setLineDash([]);

	const labelSize = Math.max(15, Math.round(cw * 0.032));
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	// Boss line at the finish.
	if (level.length - state.z < VIEW_DIST + 10) {
		const y = yForZ(level.length);
		ctx.fillStyle = "rgba(244, 63, 94, 0.35)";
		ctx.fillRect(x0, y - 26, x1 - x0, 52);
		ctx.fillStyle = "#fda4af";
		ctx.font = `bold ${labelSize + 6}px system-ui, sans-serif`;
		ctx.fillText(`BOSS ${level.boss}`, mid, y);
	}

	// Upcoming gate pairs.
	for (const pair of level.gatePairs) {
		if (pair.z <= state.z || pair.z > state.z + VIEW_DIST) {
			continue;
		}
		const y = yForZ(pair.z);
		for (const gate of pair.gates) {
			const gx0 = gate.side === 0 ? x0 : mid;
			const gx1 = gate.side === 0 ? mid : x1;
			ctx.fillStyle = gateIsGood(gate)
				? "rgba(52, 211, 153, 0.3)"
				: "rgba(248, 113, 113, 0.3)";
			ctx.fillRect(gx0 + 3, y - 22, gx1 - gx0 - 6, 44);
			ctx.strokeStyle = gateIsGood(gate) ? "#34d399" : "#f87171";
			ctx.lineWidth = 2;
			ctx.strokeRect(gx0 + 3, y - 22, gx1 - gx0 - 6, 44);
			ctx.fillStyle = gateIsGood(gate) ? "#a7f3d0" : "#fecaca";
			ctx.font = `bold ${labelSize + 4}px system-ui, sans-serif`;
			ctx.fillText(gateLabel(gate), (gx0 + gx1) / 2, y);
		}
	}

	// Enemy waves.
	for (const wave of level.waves) {
		if (wave.z <= state.z || wave.z > state.z + VIEW_DIST) {
			continue;
		}
		const y = yForZ(wave.z);
		const enemies = Math.min(10, Math.max(3, Math.round(wave.strength / 4)));
		ctx.fillStyle = "#f87171";
		for (let i = 0; i < enemies; i += 1) {
			const ex = mid + (i - (enemies - 1) / 2) * 16;
			ctx.beginPath();
			ctx.arc(ex, y, 6, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = "#fecaca";
		ctx.font = `bold ${labelSize}px system-ui, sans-serif`;
		ctx.fillText(`${wave.strength}`, mid, y - 22);
	}

	// The squad: a blob of soldiers sized by army count.
	const squadX = laneToX(state.lane);
	const soldiers = Math.min(40, Math.max(1, state.army));
	ctx.fillStyle = "#38bdf8";
	for (let i = 0; i < soldiers; i += 1) {
		const angle = i * 2.4;
		const radius = 5 * Math.sqrt(i);
		ctx.beginPath();
		ctx.arc(
			squadX + Math.cos(angle) * radius,
			squadY + Math.sin(angle) * radius * 0.7,
			5,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	}
	ctx.fillStyle = "#e0f2fe";
	ctx.font = `bold ${labelSize + 6}px system-ui, sans-serif`;
	const blobRadius = 5 * Math.sqrt(soldiers) + 16;
	ctx.fillText(`${state.army}`, squadX, squadY - blobRadius);

	// HUD: progress bar along the top (clear of the menu button).
	const barX0 = cw * 0.22;
	const barX1 = cw * 0.94;
	const barY = 22;
	ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
	ctx.fillRect(barX0, barY - 4, barX1 - barX0, 8);
	ctx.fillStyle = "#34d399";
	ctx.fillRect(
		barX0,
		barY - 4,
		(barX1 - barX0) * clamp01(state.z / level.length),
		8,
	);
	ctx.fillStyle = "#fda4af";
	ctx.font = `bold 14px system-ui, sans-serif`;
	ctx.textAlign = "right";
	ctx.fillText(`Boss ${level.boss}`, barX1, barY + 18);
	ctx.textAlign = "center";
}

export function SquadSurgeCanvas({
	level,
	paused,
	onEnd,
}: SquadSurgeCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const pausedRef = useRef(paused);
	const onEndRef = useRef(onEnd);

	useEffect(() => {
		pausedRef.current = paused;
	}, [paused]);
	useEffect(() => {
		onEndRef.current = onEnd;
	}, [onEnd]);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!container || !canvas) {
			return;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}

		let state = initialState(level);
		let targetLane = 0.5;
		let ended = false;
		let raf = 0;
		let last = performance.now();

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(container.clientWidth * dpr);
			canvas.height = Math.round(container.clientHeight * dpr);
			canvas.style.width = `${container.clientWidth}px`;
			canvas.style.height = `${container.clientHeight}px`;
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(container);

		const pointerToLane = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			const frac = (event.clientX - rect.left) / rect.width;
			targetLane = clamp01((frac - TRACK_MARGIN) / (1 - 2 * TRACK_MARGIN));
		};
		const onPointer = (event: PointerEvent) => {
			pointerToLane(event);
		};
		canvas.addEventListener("pointerdown", onPointer);
		canvas.addEventListener("pointermove", onPointer);

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "ArrowLeft" || event.key === "a") {
				targetLane = clamp01(targetLane - 0.5);
			} else if (event.key === "ArrowRight" || event.key === "d") {
				targetLane = clamp01(targetLane + 0.5);
			}
		};
		window.addEventListener("keydown", onKey);

		const frame = (now: number) => {
			const dt = Math.min((now - last) / 1000, MAX_DT);
			last = now;
			if (!pausedRef.current && !document.hidden && !isTerminal(state)) {
				state = stepSimulation(state, { targetLane }, dt, level);
				if (isTerminal(state) && !ended) {
					ended = true;
					onEndRef.current(state);
				}
			}
			const dpr = window.devicePixelRatio || 1;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			draw(ctx, canvas.width / dpr, canvas.height / dpr, level, state);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
			canvas.removeEventListener("pointerdown", onPointer);
			canvas.removeEventListener("pointermove", onPointer);
			window.removeEventListener("keydown", onKey);
		};
	}, [level]);

	return (
		<div ref={containerRef} className="h-full w-full">
			<canvas ref={canvasRef} className="block touch-none" />
		</div>
	);
}

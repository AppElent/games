import { useEffect, useRef } from "react";
import {
	applyGate,
	type Gate,
	type Level,
	type SimStatus,
	SPEED,
	WEAPONS,
	type WeaponId,
	type WeaponSpec,
} from "#/lib/games/squad-surge";
import { useMessages } from "#/lib/i18n";
import { SquadSurgeAudio } from "./audio";

/**
 * Text drawn onto the canvas via ctx.fillText — read once from the message
 * catalog in the component body (React render), then threaded as plain data
 * into the step/draw functions below, which run inside requestAnimationFrame
 * and must never call i18n hooks themselves.
 */
type CanvasStrings = {
	weaponNames: Record<WeaponId, string>;
	bossArrived: string;
	bossHudLabel: string;
};

/** Track distance visible ahead of the squad. */
const VIEW_DIST = 110;
/** Max dt per frame so tab switches don't tunnel through gates. */
const MAX_DT = 1 / 30;
/** How quickly the squad eases toward the target lane (per second). */
const LANE_RESPONSIVENESS = 10;
/** Enemies creep toward the squad on top of the squad's own speed. */
const ENEMY_MARCH = 3;
/** Distance from the finish where the squad digs in for the boss fight. */
const BOSS_STAND_DIST = 14;
const BOSS_MARCH = 3.6;
/** Only this many soldiers can fire at once — a firing line, not a blob. */
const FIRING_LINE = 24;
/** Waves grow beyond the level plan since shooting thins them pre-contact. */
function waveScale(difficulty: number) {
	return 4 + 1.2 * difficulty;
}
function bossHp(level: Level) {
	return Math.round(level.boss * (6 + 2.5 * level.difficulty));
}

type SquadSurgeCanvasProps = {
	level: Level;
	paused: boolean;
	soundOn: boolean;
	onEnd: (state: { status: SimStatus; army: number; z: number }) => void;
};

type Enemy = {
	id: number;
	z: number;
	lane: number;
	hp: number;
	maxHp: number;
	size: number;
	seed: number;
};

type Bullet = {
	fromLane: number;
	toLane: number;
	toZ: number;
	t: number;
};

type Particle = {
	lane: number;
	z: number;
	vLane: number;
	vZ: number;
	vY: number;
	y: number;
	life: number;
	maxLife: number;
	color: string;
	size: number;
};

type FloatText = {
	text: string;
	lane: number;
	z: number;
	life: number;
	color: string;
	big: boolean;
};

type Boss = { z: number; hp: number; maxHp: number };

type Runtime = {
	z: number;
	lane: number;
	targetLane: number;
	army: number;
	weapon: WeaponSpec;
	status: SimStatus;
	elapsed: number;
	nextGateIdx: number;
	nextWaveIdx: number;
	nextDropIdx: number;
	enemies: Enemy[];
	bullets: Bullet[];
	particles: Particle[];
	floats: FloatText[];
	shotBudget: number;
	fireGlow: number;
	shake: number;
	hurtFlash: number;
	goodFlash: number;
	boss: Boss | null;
	endTimer: number;
	endSent: boolean;
	enemyIdCounter: number;
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

function makeRuntime(level: Level): Runtime {
	return {
		z: 0,
		lane: 0.5,
		targetLane: 0.5,
		army: level.startArmy,
		weapon: WEAPONS.pistol,
		status: "running",
		elapsed: 0,
		nextGateIdx: 0,
		nextWaveIdx: 0,
		nextDropIdx: 0,
		enemies: [],
		bullets: [],
		particles: [],
		floats: [],
		shotBudget: 0,
		fireGlow: 0,
		shake: 0,
		hurtFlash: 0,
		goodFlash: 0,
		boss: null,
		endTimer: 0,
		endSent: false,
		enemyIdCounter: 0,
	};
}

/** Deterministic-ish hash for scenery/enemy jitter. */
function jitter(n: number) {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
}

function spawnWaveEnemies(rt: Runtime, z: number, strength: number) {
	const count = Math.min(strength, 32);
	const base = Math.floor(strength / count);
	let extra = strength - base * count;
	for (let i = 0; i < count; i += 1) {
		const hp = base + (extra > 0 ? 1 : 0);
		extra -= 1;
		const s = jitter(rt.enemyIdCounter * 7.3 + i);
		rt.enemies.push({
			id: rt.enemyIdCounter,
			z: z + (jitter(i * 3.7 + z) - 0.5) * 14,
			lane: 0.12 + 0.76 * jitter(i * 1.9 + z * 0.31),
			hp,
			maxHp: hp,
			size: 1 + Math.min(1.6, (hp - 1) * 0.35),
			seed: s * 100,
		});
		rt.enemyIdCounter += 1;
	}
}

function spawnBurst(
	rt: Runtime,
	lane: number,
	z: number,
	color: string,
	count: number,
	spread = 0.06,
) {
	for (let i = 0; i < count; i += 1) {
		const a = jitter(rt.elapsed * 13 + i) * Math.PI * 2;
		const speed = 0.5 + jitter(i * 5.1) * 1.4;
		rt.particles.push({
			lane,
			z,
			vLane: Math.cos(a) * spread * speed,
			vZ: Math.sin(a) * 6 * speed,
			vY: -(20 + jitter(i * 2.2) * 50),
			y: 0,
			life: 0.5 + jitter(i * 9.7) * 0.3,
			maxLife: 0.8,
			color,
			size: 2.5 + jitter(i * 4.4) * 3,
		});
	}
}

function addFloat(
	rt: Runtime,
	text: string,
	lane: number,
	z: number,
	color: string,
	big = false,
) {
	rt.floats.push({ text, lane, z, life: 1.2, color, big });
}

function step(
	rt: Runtime,
	level: Level,
	dt: number,
	audio: SquadSurgeAudio,
	keys: Set<string>,
	strings: CanvasStrings,
) {
	rt.elapsed += dt;
	rt.fireGlow = Math.max(0, rt.fireGlow - dt * 6);
	rt.shake = Math.max(0, rt.shake - dt * 26);
	rt.hurtFlash = Math.max(0, rt.hurtFlash - dt * 2.4);
	rt.goodFlash = Math.max(0, rt.goodFlash - dt * 2.4);

	// Effects keep animating after the run ends; the sim itself stops.
	updateEffects(rt, dt);
	if (rt.status !== "running") {
		rt.endTimer += dt;
		return;
	}

	// Steering: held keys nudge, pointer sets target directly.
	if (keys.has("left")) {
		rt.targetLane = clamp01(rt.targetLane - 2.4 * dt);
	}
	if (keys.has("right")) {
		rt.targetLane = clamp01(rt.targetLane + 2.4 * dt);
	}
	const ease = Math.min(1, LANE_RESPONSIVENESS * dt);
	rt.lane = clamp01(rt.lane + (rt.targetLane - rt.lane) * ease);

	// Advance — but dig in for the boss fight at the end of the track.
	const standZ = level.length - BOSS_STAND_DIST;
	const inBossFight = rt.boss !== null;
	if (!inBossFight) {
		rt.z = Math.min(rt.z + SPEED * dt, standZ + 0.001);
		if (rt.z >= standZ) {
			rt.boss = {
				z: level.length + 10,
				hp: bossHp(level),
				maxHp: bossHp(level),
			};
			addFloat(rt, strings.bossArrived, 0.5, rt.z + 40, "#fda4af", true);
			audio.bossRoar();
			rt.shake = Math.max(rt.shake, 7);
		}
	}

	// Spawn wave enemies as they come into view.
	while (rt.nextWaveIdx < level.waves.length) {
		const wave = level.waves[rt.nextWaveIdx];
		if (wave.z > rt.z + VIEW_DIST) {
			break;
		}
		// Hordes stay small early, swell toward the end of the track, and
		// always scale with the current army so a snowballed squad still
		// has something to chew through.
		const ramp = 0.3 + 0.7 * clamp01(wave.z / level.length);
		const planned = wave.strength * waveScale(level.difficulty) * ramp;
		const armyFloor = rt.army * (0.2 + 0.06 * level.difficulty);
		spawnWaveEnemies(
			rt,
			wave.z,
			Math.max(1, Math.round(Math.max(planned, armyFloor))),
		);
		rt.nextWaveIdx += 1;
	}

	// Gates.
	while (rt.nextGateIdx < level.gatePairs.length) {
		const pair = level.gatePairs[rt.nextGateIdx];
		if (pair.z > rt.z) {
			break;
		}
		const side: 0 | 1 = rt.lane < 0.5 ? 0 : 1;
		const chosen = pair.gates[0].side === side ? pair.gates[0] : pair.gates[1];
		const before = rt.army;
		rt.army = applyGate(rt.army, chosen);
		const delta = rt.army - before;
		const laneAt = side === 0 ? 0.25 : 0.75;
		if (delta >= 0) {
			addFloat(
				rt,
				delta > 0 ? `+${delta}` : gateLabel(chosen),
				laneAt,
				pair.z,
				"#6ee7b7",
				true,
			);
			spawnBurst(rt, laneAt, rt.z + 2, "#34d399", 14);
			rt.goodFlash = 0.5;
			audio.gateGood();
		} else {
			addFloat(rt, `${delta}`, laneAt, pair.z, "#fca5a5", true);
			spawnBurst(rt, laneAt, rt.z + 2, "#f87171", 10);
			rt.hurtFlash = Math.max(rt.hurtFlash, 0.35);
			audio.gateBad();
		}
		rt.nextGateIdx += 1;
		if (rt.army <= 0) {
			rt.status = "lost";
			audio.lose();
			return;
		}
	}

	// Weapon crates — grabbed only when driving over their side of the road.
	while (rt.nextDropIdx < level.weaponDrops.length) {
		const drop = level.weaponDrops[rt.nextDropIdx];
		if (drop.z > rt.z) {
			break;
		}
		if (Math.abs(rt.lane - drop.lane) < 0.28) {
			const spec = WEAPONS[drop.weapon];
			if (spec.tier > rt.weapon.tier) {
				rt.weapon = spec;
				addFloat(
					rt,
					strings.weaponNames[spec.id].toUpperCase(),
					rt.lane,
					drop.z,
					spec.color,
					true,
				);
				spawnBurst(rt, rt.lane, rt.z + 2, spec.color, 16);
				audio.pickup();
			}
		}
		rt.nextDropIdx += 1;
	}

	// Enemies march toward the squad and home in on its lane.
	for (const enemy of rt.enemies) {
		enemy.z -= ENEMY_MARCH * dt;
		const pursuit = enemy.z - rt.z < 30 ? 0.55 : 0.12;
		enemy.lane += (rt.lane - enemy.lane) * pursuit * dt;
	}
	if (rt.boss) {
		rt.boss.z -= BOSS_MARCH * dt;
	}

	// Auto-fire: every soldier shoots. Shots resolve instantly; tracers are
	// visual. Budget accumulates fractional shots across frames.
	const w = rt.weapon;
	// On the road only the front ranks can fire; in the boss standoff the
	// whole army lines up, so a big squad melts the boss as its reward.
	const firingLine = rt.boss ? rt.army : Math.min(rt.army, FIRING_LINE);
	rt.shotBudget += firingLine * w.rps * dt;
	let fired = false;
	while (rt.shotBudget >= 1) {
		rt.shotBudget -= 1;
		// Nearest live target in range.
		let target: Enemy | null = null;
		for (const enemy of rt.enemies) {
			if (enemy.hp <= 0 || enemy.z <= rt.z || enemy.z > rt.z + w.range) {
				continue;
			}
			if (!target || enemy.z < target.z) {
				target = enemy;
			}
		}
		if (target) {
			target.hp -= w.damage;
			fired = true;
			if (rt.bullets.length < 26) {
				rt.bullets.push({
					fromLane: rt.lane + (jitter(rt.shotBudget * 31) - 0.5) * 0.12,
					toLane: target.lane,
					toZ: target.z,
					t: 0,
				});
			}
			if (target.hp <= 0) {
				spawnBurst(rt, target.lane, target.z, "#f87171", 7);
				audio.kill();
			}
		} else if (rt.boss && rt.boss.z <= rt.z + w.range + BOSS_STAND_DIST) {
			// Dump the whole remaining budget into the boss in one batch so a
			// huge army doesn't spin this loop thousands of times per frame.
			const shots = 1 + Math.floor(rt.shotBudget);
			rt.shotBudget -= shots - 1;
			rt.boss.hp -= w.damage * shots;
			fired = true;
			if (rt.bullets.length < 26) {
				rt.bullets.push({
					fromLane: rt.lane + (jitter(rt.shotBudget * 31) - 0.5) * 0.12,
					toLane: 0.5 + Math.sin(rt.elapsed * 9) * 0.05,
					toZ: rt.boss.z,
					t: 0,
				});
			}
		} else {
			// Nothing to shoot — don't bank shots.
			rt.shotBudget = 0;
			break;
		}
	}
	if (fired) {
		rt.fireGlow = 1;
		audio.shoot(700 + w.tier * 250);
	}
	rt.enemies = rt.enemies.filter((enemy) => enemy.hp > 0);

	// Contact: an enemy that reaches the squad's lane takes soldiers with it.
	// Enemies that miss shamble past and despawn behind the squad.
	for (const enemy of rt.enemies) {
		if (enemy.z <= rt.z + 1.5 && Math.abs(enemy.lane - rt.lane) < 0.24) {
			enemy.hp = 0;
			rt.army = Math.max(0, rt.army - enemy.maxHp);
			addFloat(rt, `-${enemy.maxHp}`, enemy.lane, rt.z + 6, "#fca5a5", false);
			spawnBurst(rt, enemy.lane, rt.z + 2, "#f87171", 10);
			rt.shake = Math.max(rt.shake, 5);
			rt.hurtFlash = 0.6;
			audio.hurt();
		}
	}
	rt.enemies = rt.enemies.filter((enemy) => enemy.hp > 0 && enemy.z > rt.z - 5);
	if (rt.army <= 0) {
		rt.status = "lost";
		audio.lose();
		return;
	}

	// Boss resolution.
	if (rt.boss) {
		if (rt.boss.hp <= 0) {
			spawnBurst(rt, 0.5, rt.boss.z, "#fbbf24", 30, 0.14);
			spawnBurst(rt, 0.5, rt.boss.z, "#f87171", 24, 0.1);
			rt.boss = null;
			rt.status = "won";
			rt.shake = 8;
			audio.win();
			return;
		}
		if (rt.boss.z <= rt.z + 3) {
			rt.army = 0;
			rt.status = "lost";
			rt.hurtFlash = 1;
			rt.shake = 9;
			audio.lose();
			return;
		}
	}
}

function updateEffects(rt: Runtime, dt: number) {
	for (const bullet of rt.bullets) {
		bullet.t += dt / 0.11;
	}
	rt.bullets = rt.bullets.filter((bullet) => bullet.t < 1);
	for (const particle of rt.particles) {
		particle.lane += particle.vLane * dt;
		particle.z += particle.vZ * dt;
		particle.y += particle.vY * dt;
		particle.vY += 160 * dt;
		particle.life -= dt;
	}
	rt.particles = rt.particles.filter((particle) => particle.life > 0);
	for (const float of rt.floats) {
		float.life -= dt;
	}
	rt.floats = rt.floats.filter((float) => float.life > 0);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

type Projection = {
	yForZ: (z: number) => number;
	scaleForZ: (z: number) => number;
	laneToX: (lane: number, z: number) => number;
	roadEdge: (side: 0 | 1, z: number) => number;
	/** 0 near the camera → 1 at the horizon; drives depth-fog fading. */
	fogFor: (z: number) => number;
	mid: number;
	squadY: number;
	horizonY: number;
};

function makeProjection(
	cw: number,
	ch: number,
	camZ: number,
	camLane: number,
): Projection {
	const horizonY = ch * 0.16;
	const squadY = ch * 0.82;
	const roadHalfNear = cw * 0.42;
	const proj = (z: number) => {
		const t = clamp01((z - camZ) / VIEW_DIST);
		return (t * 1.35) / (t + 0.35);
	};
	const yForZ = (z: number) => squadY - (squadY - horizonY) * proj(z);
	const scaleForZ = (z: number) => 1 - 0.74 * proj(z);
	const fogFor = (z: number) => proj(z);
	// The camera leans gently with the squad's lane for a steering feel:
	// nearby geometry shifts opposite the lane, the horizon barely moves.
	const sway = (0.5 - camLane) * cw * 0.06;
	const midAt = (z: number) => cw / 2 + sway * scaleForZ(z);
	const laneToX = (lane: number, z: number) =>
		midAt(z) + (lane * 2 - 1) * roadHalfNear * 0.8 * scaleForZ(z);
	const roadEdge = (side: 0 | 1, z: number) =>
		midAt(z) + (side === 0 ? -1 : 1) * roadHalfNear * scaleForZ(z);
	return {
		yForZ,
		scaleForZ,
		laneToX,
		roadEdge,
		fogFor,
		mid: midAt(camZ),
		squadY,
		horizonY,
	};
}

function drawBackdrop(
	ctx: CanvasRenderingContext2D,
	cw: number,
	ch: number,
	p: Projection,
	camZ: number,
	elapsed: number,
) {
	// Night sky.
	const sky = ctx.createLinearGradient(0, 0, 0, p.horizonY + 24);
	sky.addColorStop(0, "#050816");
	sky.addColorStop(0.55, "#131a38");
	sky.addColorStop(0.85, "#3d2450");
	sky.addColorStop(1, "#7a3648");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, cw, p.horizonY + 24);

	// Stars with a gentle twinkle.
	for (let i = 0; i < 42; i += 1) {
		const sx = jitter(i * 7.7) * cw;
		const sy = jitter(i * 3.3) * p.horizonY * 0.8;
		const tw = 0.35 + 0.65 * Math.abs(Math.sin(elapsed * 0.9 + i * 1.7));
		ctx.fillStyle = `rgba(226, 232, 240, ${0.5 * tw})`;
		ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1.2, i % 5 === 0 ? 2 : 1.2);
	}

	// Moon with a soft halo.
	const mx = cw * 0.78;
	const my = p.horizonY * 0.42;
	const halo = ctx.createRadialGradient(mx, my, 4, mx, my, 60);
	halo.addColorStop(0, "rgba(226, 232, 240, 0.35)");
	halo.addColorStop(1, "rgba(226, 232, 240, 0)");
	ctx.fillStyle = halo;
	ctx.fillRect(mx - 60, my - 60, 120, 120);
	ctx.fillStyle = "#dbe3ee";
	ctx.beginPath();
	ctx.arc(mx, my, 13, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
	ctx.beginPath();
	ctx.arc(mx - 4, my + 2, 3, 0, Math.PI * 2);
	ctx.arc(mx + 5, my - 4, 2, 0, Math.PI * 2);
	ctx.fill();

	// Low warm glow on the horizon — distant fires.
	const glow = ctx.createRadialGradient(
		cw * 0.5,
		p.horizonY + 6,
		4,
		cw * 0.5,
		p.horizonY + 6,
		cw * 0.45,
	);
	glow.addColorStop(0, "rgba(249, 115, 22, 0.5)");
	glow.addColorStop(1, "rgba(249, 115, 22, 0)");
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, cw, p.horizonY + 40);

	// Far mountains, then a ruined-city silhouette in front.
	ctx.fillStyle = "#0d1226";
	ctx.beginPath();
	ctx.moveTo(0, p.horizonY + 2);
	for (let x = 0; x <= cw; x += cw / 24) {
		const h = 14 + jitter(Math.floor(x / (cw / 24)) * 11.3) * 26;
		ctx.lineTo(x, p.horizonY + 2 - h);
	}
	ctx.lineTo(cw, p.horizonY + 2);
	ctx.closePath();
	ctx.fill();
	for (let i = 0; i < 16; i += 1) {
		const bw = cw / 16;
		const bh = 8 + jitter(i * 3.1) * 30;
		ctx.fillStyle = "#151129";
		ctx.fillRect(i * bw + 1, p.horizonY - bh + 10, bw - 4, bh);
		if (i % 3 === 0) {
			ctx.fillStyle = "rgba(251, 191, 36, 0.5)";
			ctx.fillRect(i * bw + bw * 0.3, p.horizonY - bh + 16, 2, 2);
			ctx.fillRect(i * bw + bw * 0.6, p.horizonY - bh + 22, 2, 2);
		}
	}

	// Ground.
	const ground = ctx.createLinearGradient(0, p.horizonY, 0, ch);
	ground.addColorStop(0, "#232c22");
	ground.addColorStop(0.4, "#1a2119");
	ground.addColorStop(1, "#0c110d");
	ctx.fillStyle = ground;
	ctx.fillRect(0, p.horizonY, cw, ch - p.horizonY);

	// Scenery scrolling past: dead trees, rocks, sandbag barricades.
	const start = Math.ceil(camZ / 12) * 12;
	for (let z = start; z < camZ + VIEW_DIST; z += 12) {
		const s = p.scaleForZ(z);
		const y = p.yForZ(z);
		const fade = 1 - p.fogFor(z) * 0.85;
		for (const side of [0, 1] as const) {
			const kind = Math.floor(jitter(z * 1.31 + side * 17) * 3);
			const edge = p.roadEdge(side, z);
			const off =
				(side === 0 ? -1 : 1) * (26 + jitter(z * 0.7 + side) * 90) * s;
			const x = edge + off;
			ctx.globalAlpha = fade;
			if (kind === 0) {
				// Dead tree.
				ctx.strokeStyle = "#2f3a2c";
				ctx.lineWidth = 3.5 * s;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x, y - 30 * s);
				ctx.moveTo(x, y - 16 * s);
				ctx.lineTo(x - 9 * s, y - 26 * s);
				ctx.moveTo(x, y - 21 * s);
				ctx.lineTo(x + 8 * s, y - 30 * s);
				ctx.stroke();
			} else if (kind === 1) {
				// Rock.
				ctx.fillStyle = "#333c44";
				ctx.beginPath();
				ctx.ellipse(x, y - 4 * s, 11 * s, 7 * s, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#3f4a54";
				ctx.beginPath();
				ctx.ellipse(x - 3 * s, y - 8 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
				ctx.fill();
			} else {
				// Sandbag barricade.
				ctx.fillStyle = "#4a4433";
				ctx.fillRect(x - 10 * s, y - 7 * s, 20 * s, 7 * s);
				ctx.fillStyle = "#5a5340";
				ctx.fillRect(x - 6 * s, y - 12 * s, 12 * s, 6 * s);
			}
			ctx.globalAlpha = 1;
		}
	}
}

function drawRoad(
	ctx: CanvasRenderingContext2D,
	p: Projection,
	camZ: number,
	trackLength: number,
) {
	// Asphalt trapezoid.
	const farZ = camZ + VIEW_DIST;
	const centerAt = (z: number) => (p.roadEdge(0, z) + p.roadEdge(1, z)) / 2;
	ctx.beginPath();
	ctx.moveTo(p.roadEdge(0, camZ), p.squadY + 60);
	ctx.lineTo(p.roadEdge(0, farZ), p.yForZ(farZ));
	ctx.lineTo(p.roadEdge(1, farZ), p.yForZ(farZ));
	ctx.lineTo(p.roadEdge(1, camZ), p.squadY + 60);
	ctx.closePath();
	const road = ctx.createLinearGradient(0, p.yForZ(farZ), 0, p.squadY);
	road.addColorStop(0, "#1c2130");
	road.addColorStop(0.6, "#2a3045");
	road.addColorStop(1, "#3a415c");
	ctx.fillStyle = road;
	ctx.fill();

	// Wheel-wear strips down each lane.
	for (const lane of [0.25, 0.75]) {
		ctx.beginPath();
		ctx.moveTo(p.laneToX(lane - 0.09, camZ), p.squadY + 60);
		ctx.lineTo(p.laneToX(lane - 0.09, farZ), p.yForZ(farZ));
		ctx.lineTo(p.laneToX(lane + 0.09, farZ), p.yForZ(farZ));
		ctx.lineTo(p.laneToX(lane + 0.09, camZ), p.squadY + 60);
		ctx.closePath();
		ctx.fillStyle = "rgba(10, 12, 22, 0.25)";
		ctx.fill();
	}

	// Cracks scrolling by.
	ctx.strokeStyle = "rgba(12, 14, 24, 0.55)";
	const crackStart = Math.floor(camZ / 13) * 13;
	for (let z = crackStart; z < farZ; z += 13) {
		if (z <= camZ) {
			continue;
		}
		const s = p.scaleForZ(z);
		const lane = 0.15 + jitter(z * 2.17) * 0.7;
		const x = p.laneToX(lane, z);
		const y = p.yForZ(z);
		ctx.lineWidth = 1.6 * s;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + 14 * s, y - 5 * s);
		ctx.lineTo(x + 22 * s, y + 2 * s);
		ctx.stroke();
	}

	// Glowing edge lines.
	ctx.save();
	ctx.shadowColor = "rgba(250, 204, 21, 0.8)";
	ctx.shadowBlur = 8;
	ctx.strokeStyle = "rgba(250, 204, 21, 0.6)";
	ctx.lineWidth = 3;
	for (const side of [0, 1] as const) {
		ctx.beginPath();
		ctx.moveTo(p.roadEdge(side, camZ), p.squadY + 60);
		ctx.lineTo(p.roadEdge(side, farZ), p.yForZ(farZ));
		ctx.stroke();
	}
	ctx.restore();

	// Scrolling center dashes.
	ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
	const start = Math.floor(camZ / 9) * 9;
	for (let z = start; z < farZ; z += 9) {
		const z0 = Math.max(z, camZ + 0.5);
		const z1 = Math.min(z + 4.5, farZ);
		if (z1 <= z0) {
			continue;
		}
		ctx.lineWidth = 4 * p.scaleForZ(z0);
		ctx.beginPath();
		ctx.moveTo(centerAt(z0), p.yForZ(z0));
		ctx.lineTo(centerAt(z1), p.yForZ(z1));
		ctx.stroke();
	}

	// Depth haze: the far road melts into the horizon glow.
	const haze = ctx.createLinearGradient(0, p.horizonY, 0, p.horizonY + 90);
	haze.addColorStop(0, "rgba(122, 54, 72, 0.55)");
	haze.addColorStop(1, "rgba(122, 54, 72, 0)");
	ctx.fillStyle = haze;
	ctx.fillRect(0, p.horizonY, ctx.canvas.clientWidth, 90);

	// Finish line checkerboard just before the boss arena.
	if (trackLength - camZ < VIEW_DIST) {
		const y0 = p.yForZ(trackLength - 3);
		const y1 = p.yForZ(trackLength);
		const x0 = p.roadEdge(0, trackLength);
		const x1 = p.roadEdge(1, trackLength);
		const cells = 10;
		for (let i = 0; i < cells; i += 1) {
			ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
			ctx.fillRect(
				x0 + ((x1 - x0) / cells) * i,
				y1,
				(x1 - x0) / cells,
				Math.max(2, y0 - y1),
			);
		}
	}
}

function drawGates(
	ctx: CanvasRenderingContext2D,
	p: Projection,
	level: Level,
	rt: Runtime,
	labelSize: number,
) {
	for (let i = rt.nextGateIdx; i < level.gatePairs.length; i += 1) {
		const pair = level.gatePairs[i];
		if (pair.z <= rt.z || pair.z > rt.z + VIEW_DIST) {
			continue;
		}
		const y = p.yForZ(pair.z);
		const s = p.scaleForZ(pair.z);
		const fade = 1 - p.fogFor(pair.z) * 0.6;
		const pulse = 0.75 + 0.25 * Math.sin(rt.elapsed * 5 + pair.z);
		const h = 74 * s;
		const center = (p.roadEdge(0, pair.z) + p.roadEdge(1, pair.z)) / 2;
		ctx.globalAlpha = fade;
		for (const gate of pair.gates) {
			const gx0 = gate.side === 0 ? p.roadEdge(0, pair.z) : center;
			const gx1 = gate.side === 0 ? center : p.roadEdge(1, pair.z);
			const good = gateIsGood(gate);
			const main = good ? "52, 211, 153" : "248, 113, 113";
			// Energy pane.
			const grad = ctx.createLinearGradient(0, y - h, 0, y);
			grad.addColorStop(0, `rgba(${main}, ${0.08 * pulse})`);
			grad.addColorStop(0.75, `rgba(${main}, ${0.3 * pulse})`);
			grad.addColorStop(1, `rgba(${main}, ${0.5 * pulse})`);
			ctx.fillStyle = grad;
			ctx.fillRect(gx0 + 5 * s, y - h, gx1 - gx0 - 10 * s, h);
			// Glowing frame.
			ctx.save();
			ctx.shadowColor = `rgba(${main}, 0.9)`;
			ctx.shadowBlur = 12 * s;
			ctx.strokeStyle = good ? "#34d399" : "#f87171";
			ctx.lineWidth = 2.5 * s;
			ctx.strokeRect(gx0 + 5 * s, y - h, gx1 - gx0 - 10 * s, h);
			ctx.restore();
			// Pylon posts with warning stripes.
			for (const px of [gx0 + 2 * s, gx1 - 9 * s]) {
				ctx.fillStyle = "#1e293b";
				ctx.fillRect(px, y - h - 6 * s, 7 * s, h + 6 * s);
				ctx.fillStyle = good ? "#10b981" : "#ef4444";
				ctx.fillRect(px, y - h - 6 * s, 7 * s, 5 * s);
				ctx.fillRect(px, y - h * 0.5, 7 * s, 4 * s);
			}
			// Crossbar light strip.
			ctx.fillStyle = `rgba(${main}, ${0.9 * pulse})`;
			ctx.fillRect(gx0 + 5 * s, y - h - 3 * s, gx1 - gx0 - 10 * s, 3 * s);
			// Label with dark outline for readability.
			const fontPx = Math.max(13, (labelSize + 8) * s);
			ctx.font = `900 ${fontPx}px system-ui, sans-serif`;
			ctx.strokeStyle = "rgba(2, 6, 23, 0.8)";
			ctx.lineWidth = 4 * s;
			ctx.strokeText(gateLabel(gate), (gx0 + gx1) / 2, y - h / 2);
			ctx.fillStyle = good ? "#d1fae5" : "#fee2e2";
			ctx.fillText(gateLabel(gate), (gx0 + gx1) / 2, y - h / 2);
		}
		ctx.globalAlpha = 1;
	}
}

function drawCrates(
	ctx: CanvasRenderingContext2D,
	p: Projection,
	level: Level,
	rt: Runtime,
	strings: CanvasStrings,
) {
	for (let i = rt.nextDropIdx; i < level.weaponDrops.length; i += 1) {
		const drop = level.weaponDrops[i];
		if (drop.z <= rt.z || drop.z > rt.z + VIEW_DIST) {
			continue;
		}
		const spec = WEAPONS[drop.weapon];
		const x = p.laneToX(drop.lane, drop.z);
		const y = p.yForZ(drop.z);
		const s = p.scaleForZ(drop.z);
		const bob = Math.sin(rt.elapsed * 4 + drop.z) * 4 * s;
		const w = 34 * s;
		ctx.globalAlpha = 1 - p.fogFor(drop.z) * 0.5;
		// Vertical light beacon so crates read from far away.
		const beam = ctx.createLinearGradient(0, y - 150 * s, 0, y);
		beam.addColorStop(0, `${spec.color}00`);
		beam.addColorStop(1, `${spec.color}55`);
		ctx.fillStyle = beam;
		ctx.fillRect(x - w * 0.45, y - 150 * s, w * 0.9, 150 * s);
		// Ground glow.
		ctx.fillStyle = `${spec.color}44`;
		ctx.beginPath();
		ctx.ellipse(x, y, w * 1.2, w * 0.5, 0, 0, Math.PI * 2);
		ctx.fill();
		// Crate.
		ctx.fillStyle = "#a16207";
		ctx.fillRect(x - w / 2, y - w + bob, w, w * 0.8);
		ctx.strokeStyle = "#fbbf24";
		ctx.lineWidth = 2.5 * s;
		ctx.strokeRect(x - w / 2, y - w + bob, w, w * 0.8);
		ctx.beginPath();
		ctx.moveTo(x - w / 2, y - w + bob);
		ctx.lineTo(x + w / 2, y - w * 0.2 + bob);
		ctx.moveTo(x + w / 2, y - w + bob);
		ctx.lineTo(x - w / 2, y - w * 0.2 + bob);
		ctx.stroke();
		ctx.fillStyle = spec.color;
		ctx.font = `bold ${Math.max(10, 13 * s)}px system-ui, sans-serif`;
		ctx.fillText(strings.weaponNames[spec.id], x, y - w * 1.35 + bob);
		ctx.globalAlpha = 1;
	}
}

function drawEnemy(
	ctx: CanvasRenderingContext2D,
	p: Projection,
	rt: Runtime,
	enemy: Enemy,
) {
	// Not yet inside the view cone — let it emerge from the horizon haze.
	if (enemy.z > rt.z + VIEW_DIST - 6) {
		return;
	}
	const x = p.laneToX(enemy.lane, enemy.z);
	const y = p.yForZ(enemy.z);
	const s = p.scaleForZ(enemy.z) * enemy.size;
	const lurch = Math.sin(rt.elapsed * 6 + enemy.seed);
	const wob = lurch * 3 * s;
	const hunch = Math.abs(Math.sin(rt.elapsed * 6 + enemy.seed)) * 2 * s;
	const r = 12 * s;
	ctx.globalAlpha = 1 - p.fogFor(enemy.z) * 0.55;
	// Shadow.
	ctx.fillStyle = "rgba(0,0,0,0.4)";
	ctx.beginPath();
	ctx.ellipse(x, y + 2 * s, r * 1.1, r * 0.36, 0, 0, Math.PI * 2);
	ctx.fill();
	// Shambling legs.
	ctx.strokeStyle = "#334155";
	ctx.lineWidth = 3.4 * s;
	ctx.beginPath();
	ctx.moveTo(x - r * 0.3, y - r * 0.9);
	ctx.lineTo(x - r * 0.45 + wob * 0.4, y);
	ctx.moveTo(x + r * 0.3, y - r * 0.9);
	ctx.lineTo(x + r * 0.45 - wob * 0.4, y);
	ctx.stroke();
	// Reaching arms.
	ctx.strokeStyle = "#4d7c0f";
	ctx.lineWidth = 3.2 * s;
	ctx.beginPath();
	ctx.moveTo(x - r * 0.7, y - r * 1.5);
	ctx.lineTo(x - r * 1.05, y - r * 1.15 + wob);
	ctx.moveTo(x + r * 0.7, y - r * 1.5);
	ctx.lineTo(x + r * 1.05, y - r * 1.15 - wob);
	ctx.stroke();
	// Hunched body — torn shirt look.
	ctx.fillStyle = "#3f6212";
	ctx.beginPath();
	ctx.ellipse(
		x + wob * 0.3,
		y - r * 1.15 + hunch,
		r * 0.8,
		r * 1.05,
		lurch * 0.12,
		0,
		Math.PI * 2,
	);
	ctx.fill();
	ctx.fillStyle = "#365314";
	ctx.beginPath();
	ctx.ellipse(
		x + wob * 0.3,
		y - r * 0.8 + hunch,
		r * 0.7,
		r * 0.5,
		0,
		0,
		Math.PI * 2,
	);
	ctx.fill();
	// Head, tilted with the lurch.
	ctx.fillStyle = "#65a30d";
	ctx.beginPath();
	ctx.arc(x + wob * 0.6, y - r * 2.15 + hunch, r * 0.52, 0, Math.PI * 2);
	ctx.fill();
	// Glowing eyes.
	ctx.save();
	ctx.shadowColor = "rgba(239, 68, 68, 0.9)";
	ctx.shadowBlur = 6 * s;
	ctx.fillStyle = "#ef4444";
	ctx.beginPath();
	ctx.arc(
		x + wob * 0.6 - r * 0.18,
		y - r * 2.2 + hunch,
		r * 0.11,
		0,
		Math.PI * 2,
	);
	ctx.arc(
		x + wob * 0.6 + r * 0.18,
		y - r * 2.2 + hunch,
		r * 0.11,
		0,
		Math.PI * 2,
	);
	ctx.fill();
	ctx.restore();
	// HP bar for tanky enemies.
	if (enemy.maxHp > 1) {
		const bw = r * 2.1;
		ctx.fillStyle = "rgba(0,0,0,0.55)";
		ctx.fillRect(x - bw / 2, y - r * 3, bw, 3.5 * s);
		ctx.fillStyle = "#4ade80";
		ctx.fillRect(x - bw / 2, y - r * 3, bw * (enemy.hp / enemy.maxHp), 3.5 * s);
	}
	ctx.globalAlpha = 1;
}

function drawBoss(
	ctx: CanvasRenderingContext2D,
	p: Projection,
	rt: Runtime,
	cw: number,
	strings: CanvasStrings,
) {
	const boss = rt.boss;
	if (!boss) {
		return;
	}
	const x = p.mid + Math.sin(rt.elapsed * 2.1) * 12;
	const y = p.yForZ(boss.z);
	const s = p.scaleForZ(boss.z) * 4.2;
	const r = 12 * s;
	const stomp = Math.abs(Math.sin(rt.elapsed * 4)) * 5 * s;
	ctx.fillStyle = "rgba(0,0,0,0.4)";
	ctx.beginPath();
	ctx.ellipse(x, y + 3, r * 1.3, r * 0.35, 0, 0, Math.PI * 2);
	ctx.fill();
	// Legs.
	ctx.fillStyle = "#581c87";
	ctx.fillRect(
		x - r * 0.7,
		y - r * 0.9 - stomp * 0.4,
		r * 0.42,
		r * 0.95 + stomp * 0.4,
	);
	ctx.fillRect(
		x + r * 0.28,
		y - r * 0.9 + stomp * 0.4 - 0.4,
		r * 0.42,
		r * 0.95 - stomp * 0.4,
	);
	// Body.
	ctx.fillStyle = "#7c3aed";
	ctx.beginPath();
	ctx.ellipse(x, y - r * 1.6 - stomp, r, r * 1.05, 0, 0, Math.PI * 2);
	ctx.fill();
	// Horns.
	ctx.fillStyle = "#facc15";
	ctx.beginPath();
	ctx.moveTo(x - r * 0.7, y - r * 2.4 - stomp);
	ctx.lineTo(x - r * 1.1, y - r * 3.1 - stomp);
	ctx.lineTo(x - r * 0.4, y - r * 2.6 - stomp);
	ctx.closePath();
	ctx.moveTo(x + r * 0.7, y - r * 2.4 - stomp);
	ctx.lineTo(x + r * 1.1, y - r * 3.1 - stomp);
	ctx.lineTo(x + r * 0.4, y - r * 2.6 - stomp);
	ctx.closePath();
	ctx.fill();
	// Eyes.
	ctx.fillStyle = "#fef08a";
	ctx.beginPath();
	ctx.arc(x - r * 0.35, y - r * 1.9 - stomp, r * 0.16, 0, Math.PI * 2);
	ctx.arc(x + r * 0.35, y - r * 1.9 - stomp, r * 0.16, 0, Math.PI * 2);
	ctx.fill();
	// Mouth.
	ctx.strokeStyle = "#1e1b4b";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(x, y - r * 1.35 - stomp, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI);
	ctx.stroke();

	// Boss HP bar, top center.
	const bw = Math.min(cw * 0.5, 320);
	const bx = cw / 2 - bw / 2;
	ctx.fillStyle = "rgba(0,0,0,0.55)";
	ctx.fillRect(bx - 3, 46, bw + 6, 18);
	ctx.fillStyle = "#7f1d1d";
	ctx.fillRect(bx, 49, bw, 12);
	ctx.fillStyle = "#f43f5e";
	ctx.fillRect(bx, 49, bw * clamp01(boss.hp / boss.maxHp), 12);
	ctx.fillStyle = "#fecdd3";
	ctx.font = "bold 12px system-ui, sans-serif";
	ctx.fillText(strings.bossHudLabel, cw / 2, 41);
}

function drawSquad(
	ctx: CanvasRenderingContext2D,
	p: Projection,
	rt: Runtime,
	labelSize: number,
) {
	const squadX = p.laneToX(rt.lane, rt.z);
	const squadY = p.squadY;
	const shown = Math.min(36, Math.max(1, rt.army));
	const run = rt.elapsed * 11;
	const tint = rt.weapon.color;
	// Fewer soldiers → bigger sprites, so a lone survivor still reads clearly.
	const u = Math.min(1.35, Math.max(0.95, 1.4 - shown * 0.013));

	// Soft ground glow under the squad while firing.
	if (rt.fireGlow > 0) {
		const g = ctx.createRadialGradient(
			squadX,
			squadY - 10,
			2,
			squadX,
			squadY - 10,
			60,
		);
		g.addColorStop(0, `rgba(253, 224, 71, ${0.16 * rt.fireGlow})`);
		g.addColorStop(1, "rgba(253, 224, 71, 0)");
		ctx.fillStyle = g;
		ctx.fillRect(squadX - 60, squadY - 70, 120, 90);
	}

	for (let i = shown - 1; i >= 0; i -= 1) {
		const angle = i * 2.4;
		const radius = 7.5 * Math.sqrt(i);
		const sx = squadX + Math.cos(angle) * radius;
		const sy = squadY + Math.sin(angle) * radius * 0.55;
		const phase = run + i * 1.7;
		const bob = Math.abs(Math.sin(phase)) * 2.2 * u;
		// Shadow.
		ctx.fillStyle = "rgba(0,0,0,0.4)";
		ctx.beginPath();
		ctx.ellipse(sx, sy + 3 * u, 7 * u, 2.6 * u, 0, 0, Math.PI * 2);
		ctx.fill();
		// Legs (running scissor).
		ctx.strokeStyle = "#1e3a8a";
		ctx.lineWidth = 3 * u;
		const leg = Math.sin(phase) * 4 * u;
		ctx.beginPath();
		ctx.moveTo(sx, sy - 6 * u - bob);
		ctx.lineTo(sx - 2.4 * u + leg, sy + 2.4 * u);
		ctx.moveTo(sx, sy - 6 * u - bob);
		ctx.lineTo(sx + 2.4 * u - leg, sy + 2.4 * u);
		ctx.stroke();
		// Body with tactical vest.
		ctx.fillStyle = "#1d4ed8";
		ctx.beginPath();
		ctx.roundRect(sx - 4 * u, sy - 13 * u - bob, 8 * u, 8.5 * u, 2 * u);
		ctx.fill();
		ctx.fillStyle = "#172554";
		ctx.fillRect(sx - 4 * u, sy - 11 * u - bob, 8 * u, 3.4 * u);
		// Gun with body + barrel.
		ctx.strokeStyle = "#0f172a";
		ctx.lineWidth = 2.6 * u;
		ctx.beginPath();
		ctx.moveTo(sx + 3 * u, sy - 10.5 * u - bob);
		ctx.lineTo(sx + 3 * u, sy - 19 * u - bob);
		ctx.stroke();
		ctx.strokeStyle = "#475569";
		ctx.lineWidth = 1.4 * u;
		ctx.beginPath();
		ctx.moveTo(sx + 3 * u, sy - 14 * u - bob);
		ctx.lineTo(sx + 5.5 * u, sy - 13 * u - bob);
		ctx.stroke();
		// Muzzle flash on the front rank while firing.
		if (rt.fireGlow > 0.35 && i < 9 && (i + Math.floor(run * 2)) % 3 === 0) {
			ctx.save();
			ctx.shadowColor = "rgba(253, 224, 71, 0.9)";
			ctx.shadowBlur = 8 * u;
			ctx.fillStyle = "#fde047";
			ctx.beginPath();
			ctx.moveTo(sx + 3 * u, sy - 19 * u - bob);
			ctx.lineTo(sx + 0.6 * u, sy - 25 * u - bob);
			ctx.lineTo(sx + 3 * u, sy - 23 * u - bob);
			ctx.lineTo(sx + 5.4 * u, sy - 25 * u - bob);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
		// Head + helmet tinted by weapon tier.
		ctx.fillStyle = "#fcd34d";
		ctx.beginPath();
		ctx.arc(sx, sy - 16 * u - bob, 4 * u, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = tint;
		ctx.beginPath();
		ctx.arc(sx, sy - 16.8 * u - bob, 4.2 * u, Math.PI, 0);
		ctx.fill();
		ctx.fillStyle = "rgba(255,255,255,0.25)";
		ctx.beginPath();
		ctx.arc(sx - 1.4 * u, sy - 18 * u - bob, 1.2 * u, 0, Math.PI * 2);
		ctx.fill();
	}

	// Army count badge.
	const blobRadius = 7 * Math.sqrt(shown) + 26;
	const label = `${rt.army}`;
	ctx.font = `bold ${labelSize + 6}px system-ui, sans-serif`;
	const tw = ctx.measureText(label).width;
	ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
	const bx = squadX - tw / 2 - 10;
	const by = squadY - blobRadius - 16;
	ctx.beginPath();
	ctx.roundRect(bx, by, tw + 20, 26, 13);
	ctx.fill();
	ctx.strokeStyle = tint;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.fillStyle = "#e0f2fe";
	ctx.fillText(label, squadX, by + 13);
}

function drawEffects(
	ctx: CanvasRenderingContext2D,
	p: Projection,
	rt: Runtime,
) {
	// Bullet tracers.
	for (const bullet of rt.bullets) {
		const x0 = p.laneToX(bullet.fromLane, rt.z);
		const y0 = p.squadY - 16;
		const x1 = p.laneToX(bullet.toLane, bullet.toZ);
		const y1 = p.yForZ(bullet.toZ) - 8;
		const t0 = bullet.t;
		const t1 = Math.min(1, bullet.t + 0.3);
		ctx.save();
		ctx.shadowColor = "rgba(253, 224, 71, 0.8)";
		ctx.shadowBlur = 5;
		ctx.strokeStyle = `rgba(253, 224, 71, ${0.9 - bullet.t * 0.6})`;
		ctx.lineWidth = 2.2;
		ctx.beginPath();
		ctx.moveTo(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0);
		ctx.lineTo(x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1);
		ctx.stroke();
		ctx.restore();
	}
	// Particles.
	for (const particle of rt.particles) {
		const x = p.laneToX(particle.lane, particle.z);
		const y = p.yForZ(particle.z) + particle.y;
		const alpha = clamp01(particle.life / particle.maxLife);
		ctx.globalAlpha = alpha;
		ctx.fillStyle = particle.color;
		ctx.beginPath();
		ctx.arc(x, y, particle.size * p.scaleForZ(particle.z), 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	// Floating texts.
	for (const float of rt.floats) {
		const x = p.laneToX(float.lane, float.z);
		const rise = (1.2 - float.life) * 46;
		const y = p.yForZ(float.z) - 30 - rise;
		ctx.globalAlpha = clamp01(float.life);
		ctx.fillStyle = float.color;
		ctx.font = `bold ${float.big ? 26 : 17}px system-ui, sans-serif`;
		ctx.strokeStyle = "rgba(0,0,0,0.6)";
		ctx.lineWidth = 4;
		ctx.strokeText(float.text, x, y);
		ctx.fillText(float.text, x, y);
	}
	ctx.globalAlpha = 1;
}

function drawHud(
	ctx: CanvasRenderingContext2D,
	cw: number,
	ch: number,
	level: Level,
	rt: Runtime,
	strings: CanvasStrings,
) {
	// Progress bar.
	const barX0 = cw * 0.24;
	const barX1 = cw * 0.76;
	const barY = 22;
	ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
	ctx.beginPath();
	ctx.roundRect(barX0, barY - 5, barX1 - barX0, 10, 5);
	ctx.fill();
	ctx.fillStyle = "#34d399";
	ctx.beginPath();
	ctx.roundRect(
		barX0,
		barY - 5,
		Math.max(10, (barX1 - barX0) * clamp01(rt.z / level.length)),
		10,
		5,
	);
	ctx.fill();
	// Skull marker at the end of the bar.
	ctx.font = "14px system-ui, sans-serif";
	ctx.fillText("💀", barX1 + 14, barY + 1);

	// Weapon chip, bottom-left.
	const spec = rt.weapon;
	const chipY = ch - 30;
	ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
	ctx.beginPath();
	ctx.roundRect(12, chipY - 16, 148, 34, 17);
	ctx.fill();
	ctx.strokeStyle = spec.color;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.fillStyle = spec.color;
	ctx.beginPath();
	ctx.arc(32, chipY + 1, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#e2e8f0";
	ctx.font = "bold 14px system-ui, sans-serif";
	ctx.textAlign = "left";
	ctx.fillText(strings.weaponNames[spec.id], 46, chipY + 1);
	ctx.textAlign = "center";
}

function draw(
	ctx: CanvasRenderingContext2D,
	cw: number,
	ch: number,
	level: Level,
	rt: Runtime,
	strings: CanvasStrings,
) {
	ctx.clearRect(0, 0, cw, ch);
	ctx.save();
	if (rt.shake > 0) {
		ctx.translate(
			(jitter(rt.elapsed * 61) - 0.5) * rt.shake,
			(jitter(rt.elapsed * 47) - 0.5) * rt.shake,
		);
	}
	const p = makeProjection(cw, ch, rt.z, rt.lane);
	const labelSize = Math.max(15, Math.round(cw * 0.028));
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	drawBackdrop(ctx, cw, ch, p, rt.z, rt.elapsed);
	drawRoad(ctx, p, rt.z, level.length);
	drawGates(ctx, p, level, rt, labelSize);
	drawCrates(ctx, p, level, rt, strings);
	// Enemies far-to-near so nearer ones overlap.
	const sorted = [...rt.enemies].sort((a, b) => b.z - a.z);
	for (const enemy of sorted) {
		drawEnemy(ctx, p, rt, enemy);
	}
	drawBoss(ctx, p, rt, cw, strings);
	drawSquad(ctx, p, rt, labelSize);
	drawEffects(ctx, p, rt);
	ctx.restore();

	// Cinematic vignette.
	const vig = ctx.createRadialGradient(
		cw / 2,
		ch * 0.55,
		Math.min(cw, ch) * 0.45,
		cw / 2,
		ch * 0.55,
		Math.max(cw, ch) * 0.75,
	);
	vig.addColorStop(0, "rgba(2, 6, 23, 0)");
	vig.addColorStop(1, "rgba(2, 6, 23, 0.5)");
	ctx.fillStyle = vig;
	ctx.fillRect(0, 0, cw, ch);

	// Damage / bonus screen tints (drawn unshaken, over everything).
	if (rt.hurtFlash > 0) {
		ctx.fillStyle = `rgba(220, 38, 38, ${0.28 * clamp01(rt.hurtFlash)})`;
		ctx.fillRect(0, 0, cw, ch);
	}
	if (rt.goodFlash > 0) {
		ctx.fillStyle = `rgba(52, 211, 153, ${0.12 * clamp01(rt.goodFlash)})`;
		ctx.fillRect(0, 0, cw, ch);
	}

	drawHud(ctx, cw, ch, level, rt, strings);
}

export function SquadSurgeCanvas({
	level,
	paused,
	soundOn,
	onEnd,
}: SquadSurgeCanvasProps) {
	const messages = useMessages();
	const squadSurge = messages.games.squadSurge;
	const strings: CanvasStrings = {
		weaponNames: {
			pistol: squadSurge.hud.weapons.pistol,
			smg: squadSurge.hud.weapons.smg,
			shotgun: squadSurge.hud.weapons.shotgun,
			minigun: squadSurge.hud.weapons.minigun,
		},
		bossArrived: squadSurge.hud.bossArrived,
		bossHudLabel: squadSurge.hud.bossHudLabel,
	};
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const pausedRef = useRef(paused);
	const onEndRef = useRef(onEnd);
	const stringsRef = useRef(strings);
	const audioRef = useRef<SquadSurgeAudio | null>(null);

	if (audioRef.current === null) {
		audioRef.current = new SquadSurgeAudio();
	}

	useEffect(() => {
		pausedRef.current = paused;
	}, [paused]);
	useEffect(() => {
		onEndRef.current = onEnd;
	}, [onEnd]);
	useEffect(() => {
		stringsRef.current = strings;
	});
	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.muted = !soundOn;
		}
	}, [soundOn]);
	useEffect(() => {
		const audio = audioRef.current;
		return () => {
			audio?.dispose();
		};
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		const audio = audioRef.current;
		if (!container || !canvas || !audio) {
			return;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}

		const rt = makeRuntime(level);
		if (import.meta.env.DEV) {
			(window as unknown as { __ssDebug?: () => unknown }).__ssDebug = () => ({
				z: rt.z,
				army: rt.army,
				elapsed: rt.elapsed,
				status: rt.status,
			});
		}
		const keys = new Set<string>();
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
			rt.targetLane = clamp01((frac - 0.1) / 0.8);
		};
		const onPointerDown = (event: PointerEvent) => {
			audio.unlock();
			pointerToLane(event);
		};
		const onPointerMove = (event: PointerEvent) => {
			if (event.buttons > 0 || event.pointerType === "touch") {
				pointerToLane(event);
			}
		};
		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointermove", onPointerMove);

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowLeft" || event.key === "a") {
				keys.add("left");
				audio.unlock();
			} else if (event.key === "ArrowRight" || event.key === "d") {
				keys.add("right");
				audio.unlock();
			}
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.key === "ArrowLeft" || event.key === "a") {
				keys.delete("left");
			} else if (event.key === "ArrowRight" || event.key === "d") {
				keys.delete("right");
			}
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		const frame = (now: number) => {
			const dt = Math.min((now - last) / 1000, MAX_DT);
			last = now;
			if (!pausedRef.current && !document.hidden) {
				step(rt, level, dt, audio, keys, stringsRef.current);
				// Give the final explosion/flash a beat before the overlay.
				if (rt.status !== "running" && !rt.endSent && rt.endTimer > 0.7) {
					rt.endSent = true;
					onEndRef.current({ status: rt.status, army: rt.army, z: rt.z });
				}
			}
			const dpr = window.devicePixelRatio || 1;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			draw(
				ctx,
				canvas.width / dpr,
				canvas.height / dpr,
				level,
				rt,
				stringsRef.current,
			);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, [level]);

	return (
		<div ref={containerRef} className="h-full w-full">
			<canvas ref={canvasRef} className="block touch-none" />
		</div>
	);
}

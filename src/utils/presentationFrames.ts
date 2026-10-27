/** Pure per-frame maths for the presentation events. The Pixi leaves feed it elapsed time and apply the result. */

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0..1 through an event. A zero-length event is already done. */
export const eventProgress = (elapsedMs: number, durationMs: number) =>
	durationMs > 0 ? clamp01(elapsedMs / durationMs) : 1;

/** Smoothstep: eases the run speed up without a kink at either end. */
export const rampFactor = (t: number) => {
	const x = clamp01(t);
	return x * x * (3 - 2 * x);
};

export const COIN_POOL = 16;
const COINS_AT_FULL_INTENSITY = 8;
const COIN_TRAVEL_MS = 900;
const COIN_ARC_PX = 60;

export const coinCount = (intensity: number) =>
	Math.min(COIN_POOL, Math.max(1, Math.round(COINS_AT_FULL_INTENSITY * (Number.isFinite(intensity) ? intensity : 1))));

export type CoinFrame = { visible: boolean; x: number; y: number };

/** Coin `index` of `count` flies from `startX` to `endX` in an arc; the last one lands as the event ends. */
export function coinFrame(args: {
	index: number;
	count: number;
	elapsedMs: number;
	durationMs: number;
	startX: number;
	endX: number;
	baseY: number;
}): CoinFrame {
	const { index, count, elapsedMs, durationMs, startX, endX, baseY } = args;
	const travel = Math.min(COIN_TRAVEL_MS, durationMs / 2);
	const spawnAt = count > 1 ? (index * (durationMs - travel)) / (count - 1) : 0;
	const t = travel > 0 ? (elapsedMs - spawnAt) / travel : 1;
	if (index >= count || t < 0 || t >= 1) return { visible: false, x: startX, y: baseY };
	return { visible: true, x: lerp(startX, endX, t), y: baseY - Math.sin(t * Math.PI) * COIN_ARC_PX };
}

const APPROACH_END = 0.4;
const HIT_START = 0.6;
const MONSTER_SPACING_PX = 70;

export type MonsterFrame = { x: number; alpha: number; hit: boolean };

/** Monsters walk in, stand while the assassin attacks, then are struck and fade. */
export function monsterFrame(progress: number, index: number, startX: number, standX: number): MonsterFrame {
	const target = standX + index * MONSTER_SPACING_PX;
	const hit = progress >= HIT_START;
	return {
		x: progress < APPROACH_END ? lerp(startX, target, progress / APPROACH_END) : target,
		alpha: hit ? 1 - (progress - HIT_START) / (1 - HIT_START) : 1,
		hit
	};
}

/** The assassin attacks once the monsters have arrived. */
export const waveAssassinPose = (progress: number) => (progress >= APPROACH_END ? "attack" : "idle");

type Counted = { children?: readonly Counted[] };

/** Display objects under `node`, not counting `node` itself: the debug "object count". */
export const countDescendants = (node: Counted | null | undefined): number =>
	(node?.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);

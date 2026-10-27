/** Below this gap (world px/s) an eased speed snaps to its target. */
const SNAP_EPSILON = 0.5;

/**
 * World distance travelled after one frame.
 * @param scrollX - Distance travelled so far, in world px.
 * @param runSpeed - World px per second.
 * @param deltaMS - Frame time in ms, so distance never depends on frame rate.
 * @param playbackSpeed - Multiplier from the speed setting.
 */
export function advanceScroll(scrollX: number, runSpeed: number, deltaMS: number, playbackSpeed = 1): number {
	return scrollX + (runSpeed * deltaMS * playbackSpeed) / 1000;
}

/**
 * `tilePosition.x` for a layer of the given parallax factor, wrapped into one tile so it stays precise
 * over long runs.
 */
export function layerOffset(scrollX: number, factor: number, tileWidth: number): number {
	const offset = (-scrollX * factor) % tileWidth;
	return offset === 0 ? 0 : offset;
}

/** Ground speed that keeps the feet planted: one stride per run cycle. */
export function groundSpeed(stridePx: number, cycleS: number, timeScale: number): number {
	return (stridePx / cycleS) * timeScale;
}

/** Exponential approach to `target`, frame-rate independent. `tauMS` is the time constant. */
export function easeSpeed(current: number, target: number, deltaMS: number, tauMS: number): number {
	if (Math.abs(target - current) < SNAP_EPSILON) return target;
	return current + (target - current) * (1 - Math.exp(-deltaMS / tauMS));
}

/** World units visible across a screen once the fixed world height is scaled to fit it. */
export function logicalWidth(screenWidth: number, screenHeight: number, worldHeight: number): number {
	return (screenWidth * worldHeight) / screenHeight;
}

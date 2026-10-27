import type { Application } from "pixi.js";

/**
 * What the game publishes for the debug menu to read. Every write is behind `import.meta.env.VITE_DEBUG === "true"`,
 * so a production build folds the writes out and drops this module with them.
 */
export type Probe = {
	scrollX: number;
	/** Eased world speed, px/s. */
	speed: number;
	/** Frames per second, smoothed. */
	fps: number;
	/** The live Pixi application. Destroyed ones are possible between a remount's unmount and first frame. */
	app: Application | null;
	assets: string;
	/** Spine animation on track 0, and how long it has played, in seconds. */
	animation: string;
	animationTime: number;
	/** React commits in the app and in the Pixi tree. */
	commits: number;
	/** Display objects (coins, monsters) mounted under the presentation host. */
	presentationObjects: number;
	/** Debug: makes presentation textures unavailable, as a failed asset would. */
	failAssets: boolean;
};

/** Weight of the newest frame in the smoothed FPS. */
const FPS_SMOOTHING = 0.1;

export const probe: Probe = {
	scrollX: 0,
	speed: 0,
	fps: 0,
	app: null,
	assets: "",
	animation: "",
	animationTime: 0,
	commits: 0,
	presentationObjects: 0,
	failAssets: false
};

/** Publishes one frame. `frameMS` is the real time since the last frame. */
export function publishFrame(app: Application, scrollX: number, speed: number, frameMS: number) {
	probe.app = app;
	probe.scrollX = scrollX;
	probe.speed = speed;
	if (frameMS <= 0) return;
	const instant = 1000 / frameMS;
	probe.fps = probe.fps === 0 ? instant : probe.fps + (instant - probe.fps) * FPS_SMOOTHING;
}

/** A `<Profiler onRender>` callback. */
export function countCommit() {
	probe.commits += 1;
}

export function resetProbe() {
	probe.scrollX = 0;
	probe.speed = 0;
	probe.fps = 0;
	probe.app = null;
	probe.assets = "";
	probe.animation = "";
	probe.animationTime = 0;
	probe.commits = 0;
	probe.presentationObjects = 0;
	probe.failAssets = false;
}

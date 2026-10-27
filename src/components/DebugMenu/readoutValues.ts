import type { Probe } from "@/utils/debugProbe";

/** Row order and labels. Units are in the label so the value stays a bare number. */
export const READOUTS = [
	{ key: "scrollX", label: "scrollX (px)" },
	{ key: "speed", label: "speed (px/s)" },
	{ key: "fps", label: "FPS" },
	{ key: "canvases", label: "canvases" },
	{ key: "tickerListeners", label: "ticker listeners" },
	{ key: "sharedTickerListeners", label: "shared ticker listeners" },
	{ key: "assets", label: "assets" },
	{ key: "animation", label: "animation" },
	{ key: "animationTime", label: "track time (s)" },
	{ key: "commits", label: "React commits" },
	{ key: "presentationObjects", label: "presentation objects" }
] as const;

export type ReadoutKey = (typeof READOUTS)[number]["key"];

/** Counts only the DOM and `Ticker.shared` can give. */
export type LiveCounts = { canvases: number; sharedTickerListeners: number };

const NOT_YET = "—";

/** One display string per row. A dash means the game has not published that value yet. */
export function readoutValues(probe: Probe, live: LiveCounts): Record<ReadoutKey, string> {
	// A destroyed application has no ticker, which is what a remount's gap between unmount and first frame looks like.
	const listeners = probe.app?.ticker?.count;
	return {
		scrollX: String(Math.round(probe.scrollX)),
		speed: String(Math.round(probe.speed)),
		fps: probe.fps ? String(Math.round(probe.fps)) : NOT_YET,
		canvases: String(live.canvases),
		tickerListeners: listeners === undefined ? NOT_YET : String(listeners),
		sharedTickerListeners: String(live.sharedTickerListeners),
		assets: probe.assets || NOT_YET,
		animation: probe.animation || NOT_YET,
		animationTime: String(Math.round(probe.animationTime * 100) / 100),
		commits: String(probe.commits),
		presentationObjects: String(probe.presentationObjects)
	};
}

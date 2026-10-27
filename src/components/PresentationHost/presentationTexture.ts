import { Assets, type Texture } from "pixi.js";

import { probe } from "@/utils/debugProbe";

/**
 * A loaded texture, or `null` when it is missing. The debug menu's "fail assets" switch makes every lookup miss, so
 * the leaves must draw nothing and the sequence must still finish on elapsed time.
 */
export function presentationTexture(alias: string): Texture | null {
	if (import.meta.env.VITE_DEBUG === "true" && probe.failAssets) return null;
	return Assets.cache.has(alias) ? Assets.get<Texture>(alias) : null;
}

import coinUrl from "@/assets/placeholder/coin.svg";
import farUrl from "@/assets/placeholder/far.svg";
import groundUrl from "@/assets/placeholder/ground.svg";
import midUrl from "@/assets/placeholder/mid.svg";
import midFarUrl from "@/assets/placeholder/midfar.svg";
import monsterUrl from "@/assets/placeholder/monster.svg";
import nearUrl from "@/assets/placeholder/near.svg";
import skyUrl from "@/assets/placeholder/sky.svg";
import characterSkeletonUrl from "@/assets/spine-boy/spineboy-ess.json?url";
import atlasUrl from "@/assets/spine-boy/spineboy-pma.atlas?url";
import textureUrl from "@/assets/spine-boy/spineboy-pma.png";

export type GameAsset = { alias: string; src: string; data?: Record<string, unknown> };

export const GAME_ASSETS: GameAsset[] = [
	{ alias: "layerSky", src: skyUrl },
	{ alias: "layerFar", src: farUrl },
	{ alias: "layerMidFar", src: midFarUrl },
	{ alias: "layerMid", src: midUrl },
	{ alias: "layerNear", src: nearUrl },
	{ alias: "layerGround", src: groundUrl },
	{ alias: "coin", src: coinUrl },
	{ alias: "monster", src: monsterUrl },
	{ alias: "assassinSkeleton", src: characterSkeletonUrl },
	// `images` is keyed by the page name written inside the .atlas file, so the bundler can hash the PNG.
	{ alias: "assassinAtlas", src: atlasUrl, data: { images: { "spineboy-pma.png": textureUrl } } }
];

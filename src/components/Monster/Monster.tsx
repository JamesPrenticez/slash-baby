import { useRef } from "react";
import { extend, useApplication, useTick } from "@pixi/react";
import { Sprite } from "pixi.js";

import { presentationTexture } from "@/components/PresentationHost/presentationTexture";
import { HIT_TINT, monsterFor, NO_TINT } from "@/constants/monsters";
import { ASSASSIN_X_FRACTION, GROUND_Y, WORLD_HEIGHT } from "@/constants/world";
import { usePresentationStore } from "@/stores/presentationStore";
import { logicalWidth } from "@/utils/parallax";
import { eventProgress, monsterFrame } from "@/utils/presentationFrames";

extend({ Sprite });

/** Gap between the assassin and the first monster. */
const STAND_OFFSET_PX = 140;
const OFFSCREEN_MARGIN_PX = 120;

type MonsterProps = { monsterId: string; index: number; durationMs: number };

/** A placeholder monster: walks in, stands, is struck (tinted) and fades. Its frame is a function of event progress. */
export function Monster({ monsterId, index, durationMs }: MonsterProps) {
	const { app } = useApplication();
	const spec = monsterFor(monsterId);
	const texture = presentationTexture(spec.alias);
	const spriteRef = useRef<Sprite>(null);

	useTick(() => {
		const sprite = spriteRef.current;
		if (!sprite) return;
		const elapsed = usePresentationStore.getState().sequence?.elapsedInEventMs ?? 0;
		const width = logicalWidth(app.screen.width, app.screen.height, WORLD_HEIGHT);
		const frame = monsterFrame(
			eventProgress(elapsed, durationMs),
			index,
			width + OFFSCREEN_MARGIN_PX,
			width * ASSASSIN_X_FRACTION + STAND_OFFSET_PX
		);
		sprite.x = frame.x;
		sprite.alpha = frame.alpha;
		sprite.tint = frame.hit ? HIT_TINT : NO_TINT;
	});

	if (!texture) return null;
	return (
		<pixiSprite
			ref={spriteRef}
			texture={texture}
			anchor={{ x: 0.5, y: 1 }}
			y={GROUND_Y}
			scale={spec.heightPx / texture.height}
			alpha={0}
		/>
	);
}

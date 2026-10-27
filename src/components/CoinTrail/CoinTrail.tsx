import { type RefObject, useRef } from "react";
import { extend, useApplication, useTick } from "@pixi/react";
import { Container, Sprite } from "pixi.js";

import { presentationTexture } from "@/components/PresentationHost/presentationTexture";
import { ASSASSIN_X_FRACTION, GROUND_Y, WORLD_HEIGHT } from "@/constants/world";
import { usePresentationStore } from "@/stores/presentationStore";
import type { WorldControl } from "@/types/presentation";
import { logicalWidth } from "@/utils/parallax";
import { coinCount, coinFrame } from "@/utils/presentationFrames";
import { setWorldControl } from "@/utils/worldControl";

extend({ Container, Sprite });

const COIN_SIZE_PX = 28;
/** Chest height above the ground: coins fly into the assassin's torso. */
const COIN_HEIGHT_PX = 70;

type CoinTrailProps = { durationMs: number; intensity: number; control: RefObject<WorldControl> };

/**
 * One pooled component: `coinCount` sprites are made on mount and only moved, shown and hidden afterwards. Unmounting
 * destroys them all, so a cancelled event leaves no coins.
 */
export function CoinTrail({ durationMs, intensity, control }: CoinTrailProps) {
	const { app } = useApplication();
	const texture = presentationTexture("coin");
	const count = coinCount(intensity);
	const sprites = useRef<(Sprite | null)[]>([]);

	useTick(() => {
		const elapsedMs = usePresentationStore.getState().sequence?.elapsedInEventMs ?? 0;
		const width = logicalWidth(app.screen.width, app.screen.height, WORLD_HEIGHT);
		for (let index = 0; index < count; index++) {
			const sprite = sprites.current[index];
			if (!sprite) continue;
			const frame = coinFrame({
				index,
				count,
				elapsedMs,
				durationMs,
				startX: width + COIN_SIZE_PX,
				endX: width * ASSASSIN_X_FRACTION,
				baseY: GROUND_Y - COIN_HEIGHT_PX
			});
			sprite.visible = frame.visible;
			sprite.position.set(frame.x, frame.y);
		}
		setWorldControl(control, 1, "run");
	});

	if (!texture) return null;
	return (
		<pixiContainer>
			{Array.from({ length: count }, (_, index) => (
				<pixiSprite
					key={index}
					ref={(sprite: Sprite | null) => {
						sprites.current[index] = sprite;
					}}
					texture={texture}
					anchor={0.5}
					scale={COIN_SIZE_PX / texture.width}
					visible={false}
				/>
			))}
		</pixiContainer>
	);
}

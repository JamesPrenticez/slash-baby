import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { extend, useApplication, useTick } from "@pixi/react";
import { Assets, Container, type Texture, TilingSprite } from "pixi.js";

import { LAYERS, RUN_SPEED, SPEED_EASE_MS, TEXTURE_SCALE, WORLD_HEIGHT } from "@/constants/world";
import type { WorldControl } from "@/types/presentation";
import { publishFrame } from "@/utils/debugProbe";
import { advanceScroll, easeSpeed, layerOffset, logicalWidth } from "@/utils/parallax";

extend({ Container, TilingSprite });

type ParallaxWorldProps = {
	running: boolean;
	/** Scales the run speed. */
	speedMultiplier?: number;
	/** Events set the run speed target through this, per frame, without a render. */
	control?: RefObject<WorldControl>;
	/** Drawn above the ground, inside the scaled world (the assassin, later the events). */
	children?: ReactNode;
};

/**
 * Fixed-height scrolling world. `scrollX` and the eased speed live in refs, so a frame never touches React state.
 */
export function ParallaxWorld({ running, speedMultiplier = 1, control, children }: ParallaxWorldProps) {
	const { app } = useApplication();
	const rootRef = useRef<Container>(null);
	const layerRefs = useRef<(TilingSprite | null)[]>([]);
	const scrollX = useRef(0);
	const speed = useRef(0);
	const targetSpeed = useRef(0);
	const baseTarget = useRef(0);

	useEffect(() => {
		baseTarget.current = running ? RUN_SPEED * speedMultiplier : 0;
	}, [running, speedMultiplier]);

	useTick(ticker => {
		const root = rootRef.current;
		if (!root) return;

		const scale = app.screen.height / WORLD_HEIGHT;
		const width = logicalWidth(app.screen.width, app.screen.height, WORLD_HEIGHT);
		root.scale.set(scale);

		targetSpeed.current =
			control?.current.runSpeed == null ? baseTarget.current : control.current.runSpeed * RUN_SPEED * speedMultiplier;
		speed.current = easeSpeed(speed.current, targetSpeed.current, ticker.deltaMS, SPEED_EASE_MS);
		scrollX.current = advanceScroll(scrollX.current, speed.current, ticker.deltaMS);

		if (import.meta.env.VITE_DEBUG === "true") publishFrame(app, scrollX.current, speed.current, ticker.elapsedMS);

		LAYERS.forEach(({ factor }, i) => {
			const layer = layerRefs.current[i];
			if (!layer) return;
			if (layer.width !== width) layer.width = width;
			layer.tilePosition.x = layerOffset(scrollX.current, factor, layer.texture.width * TEXTURE_SCALE);
		});
	});

	return (
		<pixiContainer ref={rootRef}>
			{LAYERS.map(({ alias }, i) => (
				<pixiTilingSprite
					key={alias}
					texture={Assets.get<Texture>(alias)}
					height={WORLD_HEIGHT}
					ref={(layer: TilingSprite | null) => {
						layerRefs.current[i] = layer;
						layer?.tileScale.set(TEXTURE_SCALE);
					}}
				/>
			))}
			{children}
		</pixiContainer>
	);
}

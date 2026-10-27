import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { Spine, type TrackEntry } from "@esotericsoftware/spine-pixi-v8";
import { extend, useApplication, useTick } from "@pixi/react";
import { Container } from "pixi.js";

import { ASSASSIN_ANIMATIONS, type AssassinAnimation } from "@/constants/assassinAnimations";
import { ASSASSIN_HEIGHT, ASSASSIN_X_FRACTION, GROUND_Y, WORLD_HEIGHT } from "@/constants/world";
import type { WorldControl } from "@/types/presentation";
import { probe } from "@/utils/debugProbe";
import { logicalWidth } from "@/utils/parallax";

extend({ Container });

type AssassinProps = {
	/** Events override the animation through this, per frame, without a render. */
	control?: RefObject<WorldControl>;
	animation: AssassinAnimation;
	loop?: boolean;
	timeScale?: number;
	onComplete?: () => void;
};

/** The character, held at a fixed fraction of the screen width while the world scrolls past. */
export function Assassin({ animation, loop = true, timeScale = 1, onComplete, control }: AssassinProps) {
	const { app } = useApplication();
	const holderRef = useRef<Container>(null);
	const spineRef = useRef<Spine | null>(null);
	// Spine also emits `complete` for superseded entries and for each loop of a looping one, so only the entry
	// set last may reach the consumer.
	const entryRef = useRef<TrackEntry | null>(null);
	const override = useRef<AssassinAnimation | null>(null);
	const latest = useRef({ animation, loop, timeScale, onComplete });

	useLayoutEffect(() => {
		latest.current = { animation, loop, timeScale, onComplete };
	});

	const play = () => {
		const spine = spineRef.current;
		if (!spine) return;
		const { animation, loop, timeScale } = latest.current;
		entryRef.current = spine.state.setAnimation(0, ASSASSIN_ANIMATIONS[override.current ?? animation], loop);
		entryRef.current.timeScale = timeScale;
	};

	useEffect(() => {
		const spine = Spine.from({ skeleton: "assassinSkeleton", atlas: "assassinAtlas" });
		spine.scale.set(ASSASSIN_HEIGHT / spine.getLocalBounds().height);
		spine.state.data.defaultMix = 0.2;
		spine.state.addListener({
			complete: entry => {
				if (entry === entryRef.current) latest.current.onComplete?.();
			}
		});
		spineRef.current = spine;
		holderRef.current?.addChild(spine);
		play();

		return () => {
			// Spine registers on Ticker.shared. When the Application unmounts first its renderer is gone, and destroy() throws
			// before it removes that listener, so detach it explicitly.
			spine.autoUpdate = false;
			try {
				spine.destroy();
			} catch {
				// The renderer's pipes are already destroyed; nothing is left to release.
			}
			spineRef.current = null;
			entryRef.current = null;
		};
	}, []);

	// Layout effect so the swap lands in the same commit as the state that caused it.
	useLayoutEffect(play, [animation, loop]);

	useEffect(() => {
		if (entryRef.current) entryRef.current.timeScale = timeScale;
	}, [timeScale]);

	useTick(() => {
		const wanted = control?.current.animation ?? null;
		if (wanted !== override.current) {
			override.current = wanted;
			play();
		}
		if (import.meta.env.VITE_DEBUG === "true") {
			const entry = spineRef.current?.state.tracks[0];
			probe.animation = entry?.animation?.name ?? "";
			probe.animationTime = entry?.trackTime ?? 0;
		}
		if (holderRef.current) {
			holderRef.current.x = logicalWidth(app.screen.width, app.screen.height, WORLD_HEIGHT) * ASSASSIN_X_FRACTION;
		}
	});

	return <pixiContainer ref={holderRef} y={GROUND_Y} />;
}

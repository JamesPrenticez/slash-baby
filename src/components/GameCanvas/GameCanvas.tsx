import { Profiler, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Application, useApplication } from "@pixi/react";
import { type Application as PixiApplication } from "pixi.js";

import { Assassin } from "@/components/Assassin";
import { ErrorScreen } from "@/components/ErrorScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ParallaxWorld } from "@/components/ParallaxWorld";
import { PresentationHost, PresentationOverlay } from "@/components/PresentationHost";
import { type AssassinAnimation } from "@/constants/assassinAnimations";
import { RUN_TIME_SCALE } from "@/constants/world";
import { useAssetLoader } from "@/hooks/useAssetLoader";
import type { WorldControl } from "@/types/presentation";
import { countCommit, probe } from "@/utils/debugProbe";

import styles from "./GameCanvas.module.css";

// Capped at 2: native density on most phones without the fill-rate cost of 3x.
const RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);

const limitFrameRate = (app: PixiApplication) => {
	app.ticker.maxFPS = 60;
};

/**
 * Pixi's `resizeTo` listens to window `resize` only. A host that changes size for any other reason (late CSS, a
 * scrollbar, a bar mounting, a font swap) would leave the canvas stale, so the host is observed as well.
 */
function FollowHost({ host }: { host: RefObject<HTMLElement | null> }) {
	const { app } = useApplication();

	useEffect(() => {
		if (!host.current) return;
		const observer = new ResizeObserver(() => (app as Partial<PixiApplication>).resize?.()); // destroy() nulls resize
		observer.observe(host.current);
		return () => observer.disconnect();
	}, [app, host]);

	return null;
}

/**
 * @pixi/react 8.0.5 destroys an already-initialised Application when StrictMode's simulated cleanup runs late (after
 * `init` resolves). Children mount from a flushSync'd microtask so those passive effects flush before init can finish.
 */
function SyncMount({ children }: { children: ReactNode }) {
	const [on, setOn] = useState(false);

	useEffect(() => {
		let live = true;
		queueMicrotask(() => live && flushSync(() => setOn(true)));
		return () => {
			live = false;
		};
	}, []);

	return on ? <>{children}</> : null;
}

type GameCanvasProps = {
	running: boolean;
	/** Forces one animation. Left out, the assassin runs while `running` and idles otherwise. */
	animation?: AssassinAnimation;
	/** Scales the scroll speed and the run animation together. */
	speedMultiplier?: number;
};

/** Hosts the Pixi canvas, sized to its parent. The scene mounts once the assets are loaded. */
export function GameCanvas({ running, animation, speedMultiplier = 1 }: GameCanvasProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const assets = useAssetLoader();
	// Events write here each frame; the world reads it each frame. No React state.
	const control = useRef<WorldControl>({ runSpeed: null, animation: null });

	useEffect(() => {
		if (import.meta.env.VITE_DEBUG === "true") probe.assets = assets.status;
	}, [assets.status]);

	const world = (
		<ParallaxWorld running={running} speedMultiplier={speedMultiplier} control={control}>
			<Assassin
				control={control}
				animation={animation ?? (running ? "run" : "idle")}
				timeScale={(running ? RUN_TIME_SCALE : 1) * speedMultiplier}
			/>
			<PresentationHost control={control} />
		</ParallaxWorld>
	);

	return (
		<div ref={hostRef} className={styles.host} data-testid="game-canvas">
			{assets.status === "error" && (
				<ErrorScreen message={`Failed to load the game: ${assets.error}`} onRetry={assets.retry} />
			)}
			{assets.status === "loading" && <LoadingScreen progress={assets.progress} />}
			<PresentationOverlay />
			{assets.status === "ready" && (
				<SyncMount>
					<Application resizeTo={hostRef} resolution={RESOLUTION} autoDensity antialias={false} onInit={limitFrameRate}>
						<FollowHost host={hostRef} />
						{import.meta.env.VITE_DEBUG === "true" ? (
							<Profiler id="pixi" onRender={countCommit}>
								{world}
							</Profiler>
						) : (
							world
						)}
					</Application>
				</SyncMount>
			)}
		</div>
	);
}

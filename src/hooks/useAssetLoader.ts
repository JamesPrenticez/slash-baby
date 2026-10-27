import { useCallback, useEffect, useRef, useState } from "react";
import { Assets } from "pixi.js";

import { GAME_ASSETS } from "@/constants/manifest";

Assets.loader.loadOptions = { ...Assets.loader.loadOptions, strategy: "retry", retryCount: 3, retryDelay: 500 };

type AssetState = { status: "loading"; progress: number } | { status: "ready" } | { status: "error"; error: string };

/** Loads every game asset once. Components below the `ready` gate can read them synchronously. */
export function useAssetLoader(): AssetState & { retry: () => void } {
	const [state, setState] = useState<AssetState>({ status: "loading", progress: 0 });
	const [attempt, setAttempt] = useState(0);
	// StrictMode re-runs the effect on the same instance; the ref keeps each attempt to one load.
	const started = useRef(-1);

	useEffect(() => {
		if (started.current === attempt) return;
		started.current = attempt;
		Assets.load(GAME_ASSETS, (progress: number) => setState({ status: "loading", progress }))
			.then(() => setState({ status: "ready" }))
			.catch((error: unknown) =>
				setState({ status: "error", error: error instanceof Error ? error.message : String(error) })
			);
	}, [attempt]);

	const retry = useCallback(() => {
		setState({ status: "loading", progress: 0 });
		setAttempt(n => n + 1);
	}, []);

	return { ...state, retry };
}

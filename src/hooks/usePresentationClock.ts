import { useEffect } from "react";

import { usePresentationStore } from "@/stores/presentationStore";
import type { ClockCallback } from "@/utils/fakeClock";

/** The slice of a Pixi `Ticker` the clock needs, so tests inject a fake and this file never imports Pixi. */
export type ClockSource = { add: (callback: ClockCallback) => unknown; remove: (callback: ClockCallback) => unknown };

/** Feeds each frame's `deltaMS` to the presentation store. Subscribes once per source and unsubscribes on unmount. */
export function usePresentationClock(source: ClockSource | null) {
	useEffect(() => {
		if (!source) return;
		const onFrame: ClockCallback = ({ deltaMS }) => usePresentationStore.getState().tick(deltaMS);
		source.add(onFrame);
		return () => {
			try {
				source.remove(onFrame);
			} catch {
				// An Application destroyed first has already dropped every listener, and its ticker throws on remove.
			}
		};
	}, [source]);
}

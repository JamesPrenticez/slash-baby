import { type RefObject, useEffect, useRef } from "react";
import { extend, useApplication, useTick } from "@pixi/react";
import { Container } from "pixi.js";

import { CoinTrail } from "@/components/CoinTrail";
import { MonsterWave } from "@/components/MonsterWave";
import { RunIntro } from "@/components/RunIntro";
import { usePresentationClock } from "@/hooks/usePresentationClock";
import { type LogEntry, usePresentationStore } from "@/stores/presentationStore";
import type { WorldControl } from "@/types/presentation";
import { probe } from "@/utils/debugProbe";
import { countDescendants } from "@/utils/presentationFrames";
import { setWorldControl } from "@/utils/worldControl";

extend({ Container });

/** Changes on every event start, including a restart onto the same event, so each start mounts a fresh leaf. */
const lastStartSeq = (log: LogEntry[]) =>
	log.reduce<number | undefined>((seq, entry) => (entry.kind === "start" ? entry.seq : seq), undefined);

/**
 * Runs the presentation clock on the app's ticker and mounts the leaf for the active event. React re-renders only
 * when the active event changes; everything per frame is imperative inside the leaves.
 */
export function PresentationHost({ control }: { control: RefObject<WorldControl> }) {
	const { app, isInitialised } = useApplication();
	const layerRef = useRef<Container>(null);
	const event = usePresentationStore(state => state.activeEvent);
	const startSeq = usePresentationStore(state => lastStartSeq(state.log));

	// `app.ticker` exists only once the Application is initialised; a destroyed one has none.
	usePresentationClock(isInitialised ? (app.ticker ?? null) : null);

	// With no active event the world goes back to the run state and animation the page asked for.
	useEffect(() => {
		if (!event) {
			setWorldControl(control, null, null);
		}
	}, [event, control]);

	useTick(() => {
		if (import.meta.env.VITE_DEBUG === "true") probe.presentationObjects = countDescendants(layerRef.current);
	});

	return (
		<pixiContainer ref={layerRef}>
			{event?.type === "run_intro" && <RunIntro key={startSeq} durationMs={event.durationMs} control={control} />}
			{event?.type === "coin_trail" && (
				<CoinTrail key={startSeq} durationMs={event.durationMs} intensity={event.intensity} control={control} />
			)}
			{event?.type === "monster_wave" && (
				<MonsterWave key={startSeq} durationMs={event.durationMs} monsterIds={event.monsterIds} control={control} />
			)}
		</pixiContainer>
	);
}

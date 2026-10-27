import type { RefObject } from "react";
import { useTick } from "@pixi/react";

import { usePresentationStore } from "@/stores/presentationStore";
import type { WorldControl } from "@/types/presentation";
import { eventProgress, rampFactor } from "@/utils/presentationFrames";
import { setWorldControl } from "@/utils/worldControl";

type RunIntroProps = { durationMs: number; control: RefObject<WorldControl> };

/** Eases the world from standing to full run speed over the event. Draws nothing. */
export function RunIntro({ durationMs, control }: RunIntroProps) {
	useTick(() => {
		const elapsed = usePresentationStore.getState().sequence?.elapsedInEventMs ?? 0;
		setWorldControl(control, rampFactor(eventProgress(elapsed, durationMs)), "run");
	});
	return null;
}

import type { RefObject } from "react";
import { extend, useTick } from "@pixi/react";
import { Container } from "pixi.js";

import { Monster } from "@/components/Monster";
import { usePresentationStore } from "@/stores/presentationStore";
import type { WorldControl } from "@/types/presentation";
import { eventProgress, waveAssassinPose } from "@/utils/presentationFrames";
import { setWorldControl } from "@/utils/worldControl";

extend({ Container });

type MonsterWaveProps = { durationMs: number; monsterIds: string[]; control: RefObject<WorldControl> };

/** The world stops, the monsters arrive, the assassin attacks and they are struck. */
export function MonsterWave({ durationMs, monsterIds, control }: MonsterWaveProps) {
	useTick(() => {
		const elapsed = usePresentationStore.getState().sequence?.elapsedInEventMs ?? 0;
		setWorldControl(control, 0, waveAssassinPose(eventProgress(elapsed, durationMs)));
	});

	return (
		<pixiContainer>
			{monsterIds.map((monsterId, index) => (
				<Monster key={`${monsterId}-${index}`} monsterId={monsterId} index={index} durationMs={durationMs} />
			))}
		</pixiContainer>
	);
}

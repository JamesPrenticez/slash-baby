import type { RefObject } from "react";

import type { WorldControl } from "@/types/presentation";

/** An event's per-frame request to the world. Plain writes into a ref: no React state, no render. */
export function setWorldControl(
	control: RefObject<WorldControl>,
	runSpeed: WorldControl["runSpeed"],
	animation: WorldControl["animation"]
) {
	control.current.runSpeed = runSpeed;
	control.current.animation = animation;
}

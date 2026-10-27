import { type RefObject, useEffect } from "react";

/**
 * Calls `callback` when a mousedown lands outside `ref`. Elements inside a
 * `[data-ignore-click-away]` ancestor (the control that toggles the popover,
 * a portalled child) count as inside.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, callback: () => void) {
	useEffect(() => {
		const onMouseDown = (event: MouseEvent) => {
			const { target } = event;
			if (!ref.current || !(target instanceof Element)) return;
			if (ref.current.contains(target) || target.closest("[data-ignore-click-away]")) return;
			callback();
		};

		document.addEventListener("mousedown", onMouseDown);
		return () => document.removeEventListener("mousedown", onMouseDown);
	}, [ref, callback]);
}

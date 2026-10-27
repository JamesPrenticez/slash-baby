import { useSyncExternalStore } from "react";

/** The floating bottom bar's layout (tablet and desktop landscape). The same literal as the CSS media queries. */
const TABLET_LANDSCAPE = "(min-width: 768px) and (min-height: 601px) and (orientation: landscape)";

function subscribe(onChange: () => void) {
	const query = window.matchMedia(TABLET_LANDSCAPE);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

/**
 * True for every layout that keeps the compact bottom bar: phones in either orientation, and tablets in portrait.
 * False for tablet and desktop landscape, where the bar floats. Only for what CSS cannot change, such as which
 * control a component renders; styling follows the same query in the stylesheet.
 */
export function useIsMobile(): boolean {
	return useSyncExternalStore(subscribe, () => !window.matchMedia(TABLET_LANDSCAPE).matches);
}

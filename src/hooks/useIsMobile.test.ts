import { act, renderHook } from "@testing-library/react";

import { useIsMobile } from "./useIsMobile";

/** A matchMedia whose single query can be flipped, firing the registered change listeners. */
function stubMatchMedia(initialMatches: boolean) {
	let matches = initialMatches;
	const listeners = new Set<() => void>();
	const queries: string[] = [];

	vi.stubGlobal("matchMedia", (query: string) => {
		queries.push(query);
		return {
			get matches() {
				return matches;
			},
			media: query,
			addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
			removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener)
		};
	});

	return {
		queries,
		listeners,
		set(next: boolean) {
			matches = next;
			listeners.forEach(listener => listener());
		}
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useIsMobile", () => {
	it("is false when the viewport is a tablet or desktop in landscape", () => {
		stubMatchMedia(true);
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(false);
	});

	it("is true for every other viewport (phones, tablets in portrait)", () => {
		stubMatchMedia(false);
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(true);
	});

	it("asks the same question the bar's CSS asks", () => {
		const media = stubMatchMedia(false);
		renderHook(() => useIsMobile());
		expect(media.queries).toContain("(min-width: 768px) and (min-height: 601px) and (orientation: landscape)");
	});

	it("follows the viewport as it changes, and stops listening on unmount", () => {
		const media = stubMatchMedia(false);
		const { result, unmount } = renderHook(() => useIsMobile());
		expect(result.current).toBe(true);

		act(() => media.set(true));
		expect(result.current).toBe(false);

		act(() => media.set(false));
		expect(result.current).toBe(true);

		unmount();
		expect(media.listeners.size).toBe(0);
	});
});

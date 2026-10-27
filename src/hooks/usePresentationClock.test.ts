import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { resetPresentationStore, usePresentationStore } from "@/stores/presentationStore";
import { createFakeClock } from "@/utils/fakeClock";
import { demoPlan } from "@/utils/planBuilders";

import { usePresentationClock } from "./usePresentationClock";

beforeEach(resetPresentationStore);

describe("usePresentationClock", () => {
	it("feeds each frame's deltaMS to the store, scaled by speed", () => {
		const clock = createFakeClock();
		usePresentationStore.getState().play(demoPlan());
		renderHook(() => usePresentationClock(clock));
		clock.step(500);
		expect(usePresentationStore.getState().sequence?.elapsedInEventMs).toBe(500);
		usePresentationStore.getState().setSpeed(2);
		clock.step(500);
		expect(usePresentationStore.getState().position).toBe(1);
	});

	it("registers one callback and removes it on unmount", () => {
		const clock = createFakeClock();
		const { unmount, rerender } = renderHook(() => usePresentationClock(clock));
		rerender();
		expect(clock.count).toBe(1);
		unmount();
		expect(clock.count).toBe(0);
	});

	it("survives a source whose remove throws, as a destroyed Pixi ticker does", () => {
		const source = {
			add: () => {},
			remove: () => {
				throw new TypeError("destroyed");
			}
		};
		const { unmount } = renderHook(() => usePresentationClock(source));
		expect(() => unmount()).not.toThrow();
	});

	it("does nothing without a source and re-subscribes when the source changes", () => {
		const first = createFakeClock();
		const second = createFakeClock();
		const { rerender } = renderHook(({ source }) => usePresentationClock(source), {
			initialProps: { source: null as typeof first | null }
		});
		rerender({ source: first });
		expect(first.count).toBe(1);
		rerender({ source: second });
		expect([first.count, second.count]).toEqual([0, 1]);
	});
});

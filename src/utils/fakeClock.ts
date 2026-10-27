export type ClockCallback = (ticker: { deltaMS: number }) => void;

/** A stand-in for a Pixi ticker: callbacks run only when a test calls `step`, so no test needs real timers. */
export function createFakeClock() {
	const callbacks = new Set<ClockCallback>();
	return {
		add: (callback: ClockCallback) => void callbacks.add(callback),
		remove: (callback: ClockCallback) => void callbacks.delete(callback),
		/** Registered callbacks: the "no stray ticker" check. */
		get count() {
			return callbacks.size;
		},
		step(deltaMS: number) {
			for (const callback of [...callbacks]) callback({ deltaMS });
		}
	};
}

export type FakeClock = ReturnType<typeof createFakeClock>;

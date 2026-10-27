import { useDebugStore } from "./debugStore";

const state = () => useDebugStore.getState();

describe("debugStore", () => {
	beforeEach(() => useDebugStore.setState(useDebugStore.getInitialState(), true));

	it("starts closed, on automatic animation at normal speed", () => {
		expect(state()).toMatchObject({ open: false, animation: undefined, speedMultiplier: 1, canvasKey: 0 });
	});

	it("opens and closes", () => {
		state().toggleOpen();
		expect(state().open).toBe(true);
		state().toggleOpen();
		expect(state().open).toBe(false);
	});

	it("forces an animation and hands control back with undefined", () => {
		state().setAnimation("jump");
		expect(state().animation).toBe("jump");
		state().setAnimation(undefined);
		expect(state().animation).toBeUndefined();
	});

	it("sets the speed multiplier", () => {
		state().setSpeedMultiplier(4);
		expect(state().speedMultiplier).toBe(4);
	});

	it("changes the canvas key on every remount and nothing else", () => {
		state().setAnimation("hit");
		state().remountCanvas();
		state().remountCanvas();
		expect(state()).toMatchObject({ canvasKey: 2, animation: "hit", speedMultiplier: 1, open: false });
	});
});

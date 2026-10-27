import { setWorldControl } from "./worldControl";

describe("setWorldControl", () => {
	it("writes both requests into the ref", () => {
		const control = {
			current: { runSpeed: null, animation: null } as Parameters<typeof setWorldControl>[0]["current"]
		};
		setWorldControl(control, 0.5, "attack");
		expect(control.current).toEqual({ runSpeed: 0.5, animation: "attack" });
		setWorldControl(control, null, null);
		expect(control.current).toEqual({ runSpeed: null, animation: null });
	});
});

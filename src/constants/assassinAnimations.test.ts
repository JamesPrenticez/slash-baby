import skeleton from "@/assets/spine-boy/spineboy-ess.json";

import { ASSASSIN_ANIMATIONS } from "./assassinAnimations";

describe("ASSASSIN_ANIMATIONS", () => {
	it("maps every logical name to an animation the skeleton has", () => {
		const available = Object.keys(skeleton.animations);
		for (const spineName of Object.values(ASSASSIN_ANIMATIONS)) {
			expect(available).toContain(spineName);
		}
	});
});

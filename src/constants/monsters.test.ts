import { monsterFor } from "./monsters";

describe("monsterFor", () => {
	it("gives every id the placeholder sprite", () => {
		expect(monsterFor("m1")).toEqual(monsterFor("anything"));
		expect(monsterFor("m1").alias).toBe("monster");
	});
});

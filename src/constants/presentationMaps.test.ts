import type { EventPlanId } from "@/types/round";

import { PLAN_DEMO, PRESENTATION_MAPS, SINGLE_EVENTS, singleEventPlan } from "./presentationMaps";

// Contract section 12. The Record type fails the build when the union grows; this list fails the test when the map shrinks.
const ALL_PLAN_IDS = [
	"plan_loss",
	"plan_small_win",
	"plan_standard_win",
	"plan_big_win",
	"plan_major_win",
	"plan_jackpot",
	"plan_small_win_weapon",
	"plan_loss_evolution",
	"plan_big_win_weapon_evolution",
	"plan_choice_route"
] as const satisfies readonly EventPlanId[];

describe("presentationMaps", () => {
	it("covers all ten plan ids and nothing else", () => {
		expect(Object.keys(PRESENTATION_MAPS).sort()).toEqual([...ALL_PLAN_IDS].sort());
	});

	it.each(ALL_PLAN_IDS)("%s is the demo events plus a reveal, under its own id", id => {
		const plan = PRESENTATION_MAPS[id];
		expect(plan.planId).toBe(id);
		expect(plan.events.map(e => e.type)).toEqual(["run_intro", "coin_trail", "monster_wave", "outcome_reveal"]);
	});

	it("keeps the demo plan to three events with no reveal", () => {
		expect(PLAN_DEMO.events.map(e => e.type)).toEqual(["run_intro", "coin_trail", "monster_wave"]);
	});

	it("builds a one-event plan for each single event", () => {
		for (const event of SINGLE_EVENTS) expect(singleEventPlan(event).events).toEqual([event]);
	});
});

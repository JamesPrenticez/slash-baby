import type { PresentationEvent, PresentationPlan } from "@/types/presentation";
import type { EventPlanId } from "@/types/round";

const RUN_INTRO: PresentationEvent = { type: "run_intro", durationMs: 1000 };
const COIN_TRAIL: PresentationEvent = { type: "coin_trail", durationMs: 2000, intensity: 1 };
const MONSTER_WAVE: PresentationEvent = { type: "monster_wave", durationMs: 1500, monsterIds: ["m1", "m2"] };
const OUTCOME_REVEAL: PresentationEvent = { type: "outcome_reveal", durationMs: 800 };

const planOf = (planId: string, events: PresentationEvent[]): PresentationPlan => ({ planId, version: "1", events });

/** The Phase 2 demo for the debug menu: the three events, no reveal. */
export const PLAN_DEMO = planOf("plan_demo", [RUN_INTRO, COIN_TRAIL, MONSTER_WAVE]);

/** Placeholder: every round plan is the demo plus a reveal until the real plans arrive (W5 onward). */
const placeholderPlan = (planId: EventPlanId) => planOf(planId, [...PLAN_DEMO.events, OUTCOME_REVEAL]);

export const PRESENTATION_MAPS: Record<EventPlanId, PresentationPlan> = {
	plan_loss: placeholderPlan("plan_loss"),
	plan_small_win: placeholderPlan("plan_small_win"),
	plan_standard_win: placeholderPlan("plan_standard_win"),
	plan_big_win: placeholderPlan("plan_big_win"),
	plan_major_win: placeholderPlan("plan_major_win"),
	plan_jackpot: placeholderPlan("plan_jackpot"),
	plan_small_win_weapon: placeholderPlan("plan_small_win_weapon"),
	plan_loss_evolution: placeholderPlan("plan_loss_evolution"),
	plan_big_win_weapon_evolution: placeholderPlan("plan_big_win_weapon_evolution"),
	plan_choice_route: placeholderPlan("plan_choice_route")
};

/** The events the debug menu can fire on their own (the ones that have a presentation so far). */
export const SINGLE_EVENTS: readonly PresentationEvent[] = [RUN_INTRO, COIN_TRAIL, MONSTER_WAVE, OUTCOME_REVEAL];

export const singleEventPlan = (event: PresentationEvent): PresentationPlan => planOf(`single_${event.type}`, [event]);

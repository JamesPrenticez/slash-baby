import type { PresentationEvent, PresentationPlan } from "@/types/presentation";

export const runIntro = (durationMs = 1000): PresentationEvent => ({ type: "run_intro", durationMs });
export const coinTrail = (durationMs = 2000, intensity = 1): PresentationEvent => ({
	type: "coin_trail",
	durationMs,
	intensity
});
export const monsterWave = (durationMs = 1500): PresentationEvent => ({
	type: "monster_wave",
	durationMs,
	monsterIds: ["m1"]
});
export const decisionPoint = (decisionPointId = "dp1"): PresentationEvent => ({
	type: "decision_point",
	decisionPointId
});
export const outcomeReveal = (durationMs = 500): PresentationEvent => ({ type: "outcome_reveal", durationMs });

export const buildPlan = (events: PresentationEvent[], planId = "plan_test"): PresentationPlan => ({
	planId,
	version: "1",
	events
});

/** The Phase 2 demo: run intro, coin trail, monster wave (4500 ms in total). */
export const demoPlan = () => buildPlan([runIntro(), coinTrail(), monsterWave()], "plan_demo");

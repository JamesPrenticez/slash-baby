import { describe, expect, it } from "vitest";

import {
	advance,
	cancelSequence,
	completeActive,
	type SequencerState,
	type SequencerTransition,
	startSequence
} from "./eventSequencer";
import { buildPlan, coinTrail, decisionPoint, demoPlan, monsterWave, outcomeReveal, runIntro } from "./planBuilders";

const order = (transitions: SequencerTransition[]) => transitions.map(t => `${t.kind}:${t.event.type}`);

/** Runs a plan with the given frame sizes and returns every transition and the final state. */
function run(plan = demoPlan(), frames: number[]) {
	const first = startSequence(plan);
	let state: SequencerState = first.state;
	const all = [...first.transitions];
	for (const delta of frames) {
		const step = advance(state, delta);
		state = step.state;
		all.push(...step.transitions);
	}
	return { state, all };
}

describe("eventSequencer", () => {
	it("starts on the first event", () => {
		const { state, transitions } = startSequence(demoPlan());
		expect(state).toMatchObject({ index: 0, status: "running", elapsedInEventMs: 0 });
		expect(order(transitions)).toEqual(["start:run_intro"]);
	});

	it("an empty plan is finished at once", () => {
		const { state, transitions } = startSequence(buildPlan([]));
		expect(state.status).toBe("finished");
		expect(transitions).toEqual([]);
	});

	it("plays events in the defined order and finishes", () => {
		const { state, all } = run(demoPlan(), [1000, 2000, 1500]);
		expect(order(all)).toEqual([
			"start:run_intro",
			"complete:run_intro",
			"start:coin_trail",
			"complete:coin_trail",
			"start:monster_wave",
			"complete:monster_wave"
		]);
		expect(state).toMatchObject({ status: "finished", index: 3 });
	});

	it("holds an event until its duration has elapsed", () => {
		const { state, all } = run(demoPlan(), [999]);
		expect(state).toMatchObject({ index: 0, elapsedInEventMs: 999 });
		expect(order(all)).toEqual(["start:run_intro"]);
	});

	it("carries leftover time into the next event", () => {
		const { state } = run(demoPlan(), [1250]);
		expect(state).toMatchObject({ index: 1, elapsedInEventMs: 250 });
	});

	it("one large frame completes several events in order", () => {
		const { state, all } = run(demoPlan(), [10_000]);
		expect(state.status).toBe("finished");
		expect(all.filter(t => t.kind === "complete").map(t => t.event.type)).toEqual([
			"run_intro",
			"coin_trail",
			"monster_wave"
		]);
	});

	it("zero-length events complete without time passing", () => {
		const { state, all } = run(buildPlan([runIntro(0), outcomeReveal(0)]), [0]);
		expect(state.status).toBe("finished");
		expect(order(all)).toHaveLength(4);
	});

	it("negative durations behave as zero", () => {
		const { state } = run(buildPlan([runIntro(-5)]), [0]);
		expect(state.status).toBe("finished");
	});

	it("ignores negative, NaN and infinite deltas", () => {
		for (const bad of [-100, NaN, Infinity]) {
			const { state } = run(demoPlan(), [bad]);
			expect(state).toMatchObject({ index: 0, elapsedInEventMs: 0 });
		}
	});

	it("replaying the same plan gives the same order whatever the frame size (13 #11)", () => {
		const reference = order(run(demoPlan(), [4500]).all);
		const smallFrames = Array.from({ length: 450 }, () => 10);
		const oddFrames = [7, 333, 1, 2999, 1160];
		expect(order(run(demoPlan(), smallFrames).all)).toEqual(reference);
		expect(order(run(demoPlan(), oddFrames).all)).toEqual(reference);
		expect(order(run(demoPlan(), [4500]).all)).toEqual(reference);
	});

	it("does not mutate the previous state or the plan", () => {
		const plan = Object.freeze(buildPlan([runIntro()]));
		const first = startSequence(plan).state;
		const before = { ...first };
		advance(first, 5000);
		expect(first).toEqual(before);
	});

	describe("decision_point", () => {
		const plan = () => buildPlan([runIntro(100), decisionPoint(), outcomeReveal(200)]);

		it("waits at the decision however much time passes", () => {
			const { state, all } = run(plan(), [100, 1_000_000]);
			expect(state).toMatchObject({ index: 1, status: "at_decision" });
			expect(order(all)).toEqual(["start:run_intro", "complete:run_intro", "start:decision_point"]);
		});

		it("an external signal resumes it", () => {
			const waiting = run(plan(), [100]).state;
			const step = completeActive(waiting, "signal");
			expect(order(step.transitions)).toEqual(["complete:decision_point", "start:outcome_reveal"]);
			expect(step.transitions[0]).toMatchObject({ reason: "signal" });
			expect(step.state).toMatchObject({ index: 2, status: "running" });
		});

		it("a plan can start at a decision", () => {
			expect(startSequence(buildPlan([decisionPoint()])).state.status).toBe("at_decision");
		});
	});

	describe("completeActive", () => {
		it("a timed event can be ended early by signal or skip, and the next one starts fresh", () => {
			const mid = run(demoPlan(), [400]).state;
			const step = completeActive(mid, "skipped");
			expect(step.transitions[0]).toMatchObject({ kind: "complete", reason: "skipped" });
			expect(step.state).toMatchObject({ index: 1, elapsedInEventMs: 0 });
		});

		it("the last event finishes the sequence", () => {
			const step = completeActive(startSequence(buildPlan([runIntro()])).state, "signal");
			expect(step.state.status).toBe("finished");
		});

		it("does nothing once finished or cancelled", () => {
			const finished = run(demoPlan(), [10_000]).state;
			expect(completeActive(finished, "skipped")).toEqual({ state: finished, transitions: [] });
			const cancelled = cancelSequence(startSequence(demoPlan()).state).state;
			expect(completeActive(cancelled, "skipped").transitions).toEqual([]);
		});
	});

	describe("cancelSequence", () => {
		it("reports the active event as cancelled and stops advancing", () => {
			const mid = run(demoPlan(), [1500]).state;
			const step = cancelSequence(mid);
			expect(order(step.transitions)).toEqual(["cancel:coin_trail"]);
			expect(step.state.status).toBe("cancelled");
			expect(advance(step.state, 10_000)).toEqual({ state: step.state, transitions: [] });
		});

		it("cancelling a waiting decision works", () => {
			const waiting = startSequence(buildPlan([decisionPoint()])).state;
			expect(cancelSequence(waiting).state.status).toBe("cancelled");
		});

		it("is a no-op when nothing is live", () => {
			const done = run(buildPlan([]), []).state;
			expect(cancelSequence(done)).toEqual({ state: done, transitions: [] });
		});

		it("restarting after a mid-event cancel begins cleanly from the first event", () => {
			const cancelled = cancelSequence(run(demoPlan(), [2500]).state).state;
			const restarted = startSequence(cancelled.plan);
			expect(restarted.state).toMatchObject({ index: 0, elapsedInEventMs: 0, status: "running" });
			expect(order(restarted.transitions)).toEqual(["start:run_intro"]);
		});
	});

	it("unknown-length plans with every timed event still finish by time alone (asset failure cannot stick)", () => {
		const { state } = run(buildPlan([runIntro(10), coinTrail(10), monsterWave(10), outcomeReveal(10)]), [40]);
		expect(state.status).toBe("finished");
	});
});

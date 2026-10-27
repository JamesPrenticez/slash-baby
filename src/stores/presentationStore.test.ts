import { beforeEach, describe, expect, it } from "vitest";

import { buildPlan, decisionPoint, demoPlan, outcomeReveal, runIntro } from "@/utils/planBuilders";

import { LOG_LIMIT, resetPresentationStore, usePresentationStore } from "./presentationStore";

const store = () => usePresentationStore.getState();
const logOrder = () => store().log.map(entry => `${entry.kind}:${entry.event.type}`);

/** A settled round fixture, frozen so any write throws: presentation must never touch it. */
const frozenRound = Object.freeze({
	roundId: "r1",
	wagerMinorUnits: 100,
	currency: "USD",
	status: "resolved",
	outcome: Object.freeze({ category: "big_win", payoutMinorUnits: 5000 })
});

beforeEach(resetPresentationStore);

describe("presentationStore", () => {
	it("is idle until a plan plays", () => {
		expect(store()).toMatchObject({ status: "idle", activeEvent: null, position: 0, log: [] });
		store().tick(1000);
		store().skipEvent();
		store().signalComplete();
		store().restart();
		store().cancel();
		expect(store().status).toBe("idle");
	});

	it("play starts the first event and logs it", () => {
		store().play(demoPlan());
		expect(store()).toMatchObject({ status: "running", position: 0, activeEvent: { type: "run_intro" } });
		expect(logOrder()).toEqual(["start:run_intro"]);
	});

	it("tick advances through the plan in order and finishes", () => {
		store().play(demoPlan());
		for (let i = 0; i < 450; i++) store().tick(10);
		expect(store()).toMatchObject({ status: "finished", activeEvent: null, position: 3 });
		expect(logOrder().filter(l => l.startsWith("start"))).toEqual([
			"start:run_intro",
			"start:coin_trail",
			"start:monster_wave"
		]);
	});

	it("scales time by playback speed", () => {
		store().setSpeed(4);
		store().play(demoPlan());
		store().tick(250);
		expect(store().position).toBe(1);
	});

	it("rejects invalid speeds", () => {
		for (const bad of [0, -1, NaN, Infinity]) store().setSpeed(bad);
		expect(store().playbackSpeed).toBe(1);
		store().setSpeed(0.5);
		expect(store().playbackSpeed).toBe(0.5);
	});

	it("pause freezes time and resume continues", () => {
		store().play(demoPlan());
		store().pause();
		store().tick(5000);
		expect(store()).toMatchObject({ paused: true, position: 0 });
		store().resume();
		store().tick(1000);
		expect(store().position).toBe(1);
	});

	it("step advances while paused, scaled by the speed", () => {
		store().play(demoPlan());
		store().pause();
		store().setSpeed(2);
		store().step(500);
		expect(store().position).toBe(1);
		expect(store().paused).toBe(true);
	});

	it("skipEvent ends the active event", () => {
		store().play(demoPlan());
		store().skipEvent();
		expect(store().position).toBe(1);
		expect(store().log.find(l => l.kind === "complete")).toMatchObject({ reason: "skipped" });
	});

	it("a decision waits until signalComplete", () => {
		store().play(buildPlan([runIntro(10), decisionPoint(), outcomeReveal()]));
		store().tick(1_000_000);
		expect(store()).toMatchObject({ status: "at_decision", activeEvent: { type: "decision_point" } });
		store().signalComplete();
		expect(store()).toMatchObject({ status: "running", activeEvent: { type: "outcome_reveal" } });
	});

	it("restart mid-event returns to a clean first event with an empty log, keeping speed", () => {
		store().setSpeed(2);
		store().play(demoPlan());
		store().tick(700);
		store().restart();
		expect(store()).toMatchObject({ status: "running", position: 0, playbackSpeed: 2 });
		expect(logOrder()).toEqual(["start:run_intro"]);
		expect(store().sequence?.elapsedInEventMs).toBe(0);
	});

	it("cancel mid-event clears the active event, logs it, and later ticks do nothing", () => {
		store().play(demoPlan());
		store().tick(1500);
		store().cancel();
		expect(store()).toMatchObject({ status: "cancelled", activeEvent: null });
		expect(logOrder().at(-1)).toBe("cancel:coin_trail");
		const before = store().log.length;
		store().tick(10_000);
		expect(store().log).toHaveLength(before);
		store().restart();
		expect(store()).toMatchObject({ status: "running", position: 0 });
	});

	it("replaying the same plan gives the same log order", () => {
		const play = () => {
			resetPresentationStore();
			store().play(demoPlan());
			store().tick(4500);
			return logOrder();
		};
		expect(play()).toEqual(play());
	});

	it("changing speed leaves a frozen RoundRecord fixture unchanged (13 #12)", () => {
		const snapshot = JSON.stringify(frozenRound);
		for (const speed of [0.5, 1, 2, 4]) {
			store().setSpeed(speed);
			store().play(demoPlan());
			store().tick(2000);
			store().skipEvent();
			store().restart();
		}
		expect(JSON.stringify(frozenRound)).toBe(snapshot);
		expect(Object.keys(store())).not.toContain("payoutMinorUnits");
	});

	it("keeps only the newest LOG_LIMIT entries", () => {
		store().play(buildPlan(Array.from({ length: LOG_LIMIT }, () => runIntro(1))));
		store().tick(LOG_LIMIT);
		expect(store().log).toHaveLength(LOG_LIMIT);
		expect(store().log.at(-1)?.kind).toBe("complete");
	});
});

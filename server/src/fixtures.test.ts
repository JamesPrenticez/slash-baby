// Run: pnpm test:server
// Fixture table, the seeded draw and forcing (contract §10 determinism rule).

import assert from "node:assert/strict";
import { test } from "node:test";

import { CATEGORIES, draw, drawForced, fixtureInfo, FIXTURES, forcedCandidates } from "./fixtures.ts";
import type { DebugForce } from "../../src/types/debug.ts";

const force = (patch: Partial<DebugForce>): DebugForce => ({
	fixtureId: null,
	category: null,
	policy: null,
	sticky: false,
	...patch
});

test("there are at least two fixtures for each of the six categories, with unique ids", () => {
	assert.deepEqual(CATEGORIES, ["loss", "small_win", "standard_win", "big_win", "major_win", "jackpot"]);
	for (const category of CATEGORIES) {
		assert.ok(FIXTURES.filter(f => f.category === category).length >= 2, category);
	}
	assert.equal(new Set(FIXTURES.map(f => f.fixtureId)).size, FIXTURES.length);
});

test("every Policy A fixture has an integer multiplier and its category's plan", () => {
	const fixed = FIXTURES.filter(f => f.policy === "fixed");
	for (const f of fixed) {
		assert.ok(Number.isSafeInteger(f.multiplierBps) && f.multiplierBps >= 0, f.fixtureId);
		if (f.decisions.length === 0) assert.equal(f.eventPlanId, `plan_${f.category}`, f.fixtureId);
	}
	const plans = Object.fromEntries(FIXTURES.map(f => [f.fixtureId, f.eventPlanId]));
	assert.equal(plans.dagger_choice_small, "plan_small_win_weapon");
	assert.equal(plans.evolution_loss, "plan_loss_evolution");
	assert.equal(plans.evolution_big, "plan_big_win_weapon_evolution");
	assert.equal(plans.vault_route, "plan_choice_route", "Policy B names no category");
	assert.ok(
		fixed.filter(f => f.category === "loss").every(f => f.multiplierBps === 0),
		"a loss pays nothing"
	);
	assert.ok(
		fixed.filter(f => f.category !== "loss").every(f => f.multiplierBps > 0),
		"every win pays something"
	);
	const b = FIXTURES.filter(f => f.policy === "choice_constrained");
	assert.ok(b.length >= 1 && b.every(f => f.decisions.some(d => d.outcomeEffect === "authoritative_resolution")));
});

test("the three starting decisions exist, each with at least two options and the pause policy", () => {
	const points = new Map(FIXTURES.flatMap(f => f.decisions).map(d => [d.id, d]));
	assert.deepEqual([...points.keys()].sort(), ["route_choice", "weapon_choice", "weapon_evolution"]);
	for (const d of points.values()) {
		assert.equal(d.timeoutPolicy, "pause");
		assert.ok(d.options.length >= 2);
		assert.equal(new Set(d.options.map(o => o.id)).size, d.options.length);
	}
	assert.equal(points.get("weapon_choice")!.type, "upgrade");
	assert.equal(points.get("weapon_evolution")!.type, "risk_reward");
	assert.equal(points.get("route_choice")!.outcomeEffect, "authoritative_resolution");
	assert.ok(
		FIXTURES.filter(f => f.policy === "fixed")
			.flatMap(f => f.decisions)
			.every(d => d.outcomeEffect === "presentation_only"),
		"a Policy A fixture only carries presentation_only decisions"
	);
});

test("the seeded draw never returns a decision fixture while DECISION_FIXTURES_IN_DRAW is off", () => {
	for (let i = 0; i < 2000; i++) assert.deepEqual(draw("no-decisions", i).decisions, []);
});

test("draw is pure: same seed and round index give the same fixture, in any call order", () => {
	const forward = Array.from({ length: 50 }, (_, i) => draw("seed-a", i).fixtureId);
	const backward = Array.from({ length: 50 }, (_, i) => draw("seed-a", 49 - i).fixtureId).reverse();
	assert.deepEqual(forward, backward);
	assert.notDeepEqual(
		forward,
		Array.from({ length: 50 }, (_, i) => draw("seed-b", i).fixtureId),
		"another seed gives another sequence"
	);
});

test("draw reaches every category over enough rounds, and favours losses over jackpots", () => {
	const counts = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
	for (let i = 0; i < 5000; i++) counts[draw("spread", i).category]++;
	for (const category of CATEGORIES)
		assert.ok(counts[category] > 0, `${category} never drawn: ${JSON.stringify(counts)}`);
	assert.ok(counts.loss > counts.jackpot * 5, JSON.stringify(counts));
});

test("forcedCandidates: fixtureId is exact, category and policy filter, nothing matching is empty", () => {
	assert.deepEqual(
		forcedCandidates(force({ fixtureId: FIXTURES[3].fixtureId, category: "loss" })).map(f => f.fixtureId),
		[FIXTURES[3].fixtureId],
		"fixtureId wins over the other fields"
	);
	assert.deepEqual(forcedCandidates(force({ fixtureId: "nope" })), []);
	const jackpots = forcedCandidates(force({ category: "jackpot" }));
	assert.ok(jackpots.length >= 2 && jackpots.every(f => f.category === "jackpot"));
	const plain = FIXTURES.filter(f => f.policy === "fixed" && f.decisions.length === 0);
	assert.equal(forcedCandidates(force({ policy: "fixed" })).length, plain.length, "decision fixtures need a fixtureId");
	const b = forcedCandidates(force({ policy: "choice_constrained" }));
	assert.ok(b.length >= 1 && b.every(f => f.policy === "choice_constrained"));
	assert.deepEqual(
		forcedCandidates(force({ category: "jackpot", policy: "choice_constrained" })),
		b,
		"for Policy B the category is a resolution target, not a filter"
	);
	assert.deepEqual(
		forcedCandidates(force({ fixtureId: "evolution_big" })).map(f => f.fixtureId),
		["evolution_big"]
	);
});

test("drawForced is keyed on (seed, round index) and only picks from the candidates", () => {
	const f = force({ category: "big_win" });
	const picks = Array.from({ length: 60 }, (_, i) => drawForced(f, "seed-a", i));
	assert.ok(picks.every(p => p.category === "big_win"));
	assert.deepEqual(
		picks.map(p => p.fixtureId),
		Array.from({ length: 60 }, (_, i) => drawForced(f, "seed-a", i).fixtureId)
	);
	assert.ok(new Set(picks.map(p => p.fixtureId)).size >= 2, "both big_win fixtures turn up");
	const exact = FIXTURES[5];
	assert.equal(drawForced(force({ fixtureId: exact.fixtureId }), "any", 9), exact);
});

test("fixtureInfo is the DebugFixtureInfo shape; a plain fixture has no decision points", () => {
	const f = FIXTURES[0];
	assert.deepEqual(fixtureInfo(f), {
		fixtureId: f.fixtureId,
		category: f.category,
		policy: "fixed",
		eventPlanId: f.eventPlanId,
		decisionPointIds: []
	});
});

test("fixtureInfo lists decision point ids in order", () => {
	const f = FIXTURES.find(f => f.fixtureId === "evolution_big")!;
	assert.deepEqual(fixtureInfo(f).decisionPointIds, ["weapon_choice", "weapon_evolution"]);
});

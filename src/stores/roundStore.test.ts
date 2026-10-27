import { buildRound } from "@/utils/roundBuilders";
import { initialLocal } from "@/utils/roundMachine";

import { useRoundStore } from "./roundStore";

const s = () => useRoundStore.getState();

beforeEach(() => s().reset());

describe("roundStore", () => {
	it("starts empty", () => {
		expect(s()).toMatchObject({ round: null, local: initialLocal, pending: null, resultsRoundId: null });
	});

	it("holds a server round and local patches", () => {
		const round = buildRound();
		expect(s().setRound(round)).toBe(true);
		s().setLocal({ presentation: "running" });
		s().setLocal({ configuring: true });
		expect(s().round).toBe(round);
		expect(s().local).toMatchObject({ presentation: "running", configuring: true, request: "none" });
		expect(s().setRound(null)).toBe(true);
		expect(s().round).toBeNull();
	});

	it("beginAction creates a key and marks the request", () => {
		const p = s().beginAction("start");
		expect(p.action).toBe("start");
		expect(p.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
		expect(s().pending).toBe(p);
		expect(s().local.request).toBe("start");
	});

	it("Retry of the same action reuses the key and clears the failure", () => {
		const first = s().beginAction("settle");
		s().setLocal({ failure: "connection_lost", recovering: true });
		const again = s().beginAction("settle");
		expect(again.idempotencyKey).toBe(first.idempotencyKey);
		expect(s().local).toMatchObject({ failure: "none", recovering: false, request: "settle" });
	});

	it("a different action gets a new key", () => {
		const a = s().beginAction("start");
		const b = s().beginAction("decide");
		expect(b.idempotencyKey).not.toBe(a.idempotencyKey);
	});

	it("completeAction clears pending, request and failure, so the next action gets a fresh key", () => {
		const a = s().beginAction("start");
		s().setLocal({ failure: "request_failed" });
		s().completeAction();
		expect(s().pending).toBeNull();
		expect(s().local).toMatchObject({ request: "none", failure: "none" });
		expect(s().beginAction("start").idempotencyKey).not.toBe(a.idempotencyKey);
	});

	it("a second settlement for the same round is ignored", () => {
		const settled = buildRound({ status: "settled" });
		expect(s().setRound(settled)).toBe(true);
		expect(s().resultsRoundId).toBe("r1");
		const dup = buildRound({ status: "settled" });
		expect(s().setRound(dup)).toBe(false);
		expect(s().round).toBe(settled);
	});

	it("a settled round with a new id is accepted", () => {
		s().setRound(buildRound({ status: "settled" }));
		expect(s().setRound(buildRound({ roundId: "r2", status: "settled" }))).toBe(true);
		expect(s().round?.roundId).toBe("r2");
	});

	it("reset clears everything including the results guard", () => {
		s().setRound(buildRound({ status: "settled" }));
		s().beginAction("start");
		s().reset();
		expect(s()).toMatchObject({ round: null, pending: null, resultsRoundId: null });
	});
});

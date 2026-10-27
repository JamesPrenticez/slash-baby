import type { RoundRecord } from "@/types/round";

import { buildDecision, buildLocal, buildRound } from "./roundBuilders";
import { type ClientState, type LocalProgress, roundMachine } from "./roundMachine";

type Row = [string, RoundRecord | null, Partial<LocalProgress>, ClientState, boolean?];

const upgrade = buildRound({ status: "awaiting_choice", pendingDecision: buildDecision("upgrade") });
const risk = buildRound({ status: "awaiting_choice", pendingDecision: buildDecision("risk_reward") });
const status = (s: RoundRecord["status"]) => buildRound({ status: s });

const rows: Row[] = [
	// contract section 6, one per row
	["no round, request none", null, {}, "IDLE"],
	["no round, configuring", null, { configuring: true }, "CONFIGURING_BET"],
	["no round, request start", null, { request: "start" }, "SUBMITTING_BET"],
	["accepted, any local", status("accepted"), { presentation: "running" }, "ROUND_ACCEPTED"],
	["running, presentation running", status("running"), { presentation: "running" }, "PRESENTATION_RUNNING"],
	["running, presentation finished", status("running"), { presentation: "finished" }, "RESOLVING_OUTCOME"],
	["awaiting_choice, presentation running", upgrade, { presentation: "running" }, "PRESENTATION_RUNNING"],
	["awaiting_choice, at_decision upgrade", upgrade, { presentation: "at_decision" }, "AWAITING_UPGRADE"],
	["awaiting_choice, at_decision risk_reward", risk, { presentation: "at_decision" }, "AWAITING_RISK_CHOICE"],
	["resolved, presentation running", status("resolved"), { presentation: "running" }, "PRESENTATION_RUNNING", true],
	["resolved, finished, request none", status("resolved"), { presentation: "finished" }, "OUTCOME_CONFIRMED", true],
	[
		"resolved, finished, request settle",
		status("resolved"),
		{ presentation: "finished", request: "settle" },
		"SETTLEMENT_PENDING",
		true
	],
	["settled, presentation running", status("settled"), { presentation: "running" }, "PRESENTATION_RUNNING"],
	["settled, presentation finished", status("settled"), { presentation: "finished" }, "SETTLED"],
	["any, request_failed", status("running"), { failure: "request_failed" }, "REQUEST_FAILED"],
	["any, connection_lost", status("running"), { failure: "connection_lost" }, "CONNECTION_LOST"],
	["any, recovering", status("running"), { recovering: true }, "RECOVERING_ROUND"],
	["any, status_unknown", status("running"), { failure: "status_unknown" }, "ROUND_STATUS_UNKNOWN"],
	["boot, loading", null, { loading: true }, "LOADING"],
	// cases the table leaves open
	["no round, request settle", null, { request: "settle" }, "IDLE"],
	["running, presentation idle", status("running"), {}, "PRESENTATION_RUNNING"],
	["awaiting_choice, finished", upgrade, { presentation: "finished" }, "AWAITING_UPGRADE"],
	[
		"awaiting_choice without a decision",
		status("awaiting_choice"),
		{ presentation: "at_decision" },
		"PRESENTATION_RUNNING"
	],
	["resolved, idle", status("resolved"), {}, "PRESENTATION_RUNNING", true],
	["settled, at_decision", status("settled"), { presentation: "at_decision" }, "PRESENTATION_RUNNING"],
	// precedence
	["loading beats failure", status("running"), { loading: true, failure: "request_failed" }, "LOADING"],
	[
		"status_unknown beats recovering",
		status("resolved"),
		{ failure: "status_unknown", recovering: true },
		"ROUND_STATUS_UNKNOWN",
		true
	],
	["recovering beats connection_lost", null, { recovering: true, failure: "connection_lost" }, "RECOVERING_ROUND"]
];

describe("roundMachine", () => {
	it.each(rows)("%s", (_name, round, local, state, confirmed = false) => {
		expect(roundMachine(round, buildLocal(local))).toEqual({ state, outcomeConfirmed: confirmed });
	});

	it("never returns OUTCOME_CONFIRMED or SETTLED from presentation progress alone", () => {
		const statuses = ["accepted", "running", "awaiting_choice"] as const;
		for (const s of statuses)
			for (const presentation of ["idle", "running", "at_decision", "finished"] as const)
				for (const request of ["none", "start", "decide", "settle"] as const) {
					const { state } = roundMachine(status(s), buildLocal({ presentation, request }));
					expect(["OUTCOME_CONFIRMED", "SETTLEMENT_PENDING", "SETTLED"]).not.toContain(state);
				}
		for (const presentation of ["idle", "running", "at_decision", "finished"] as const)
			expect(roundMachine(status("resolved"), buildLocal({ presentation })).state).not.toBe("SETTLED");
		expect(roundMachine(null, buildLocal({ presentation: "finished" })).state).toBe("IDLE");
	});

	it("ROUND_STATUS_UNKNOWN only comes from the failure flag", () => {
		const failures = ["none", "request_failed", "connection_lost"] as const;
		for (const r of [null, status("running"), status("resolved"), status("settled"), upgrade])
			for (const failure of failures)
				for (const recovering of [false, true])
					expect(roundMachine(r, buildLocal({ failure, recovering, presentation: "finished" })).state).not.toBe(
						"ROUND_STATUS_UNKNOWN"
					);
	});
});

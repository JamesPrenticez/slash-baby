import type { RoundRecord } from "@/types/round";

export type LocalRequest = "none" | "start" | "decide" | "settle";
export type LocalPresentation = "idle" | "running" | "at_decision" | "finished";
export type LocalFailure = "none" | "request_failed" | "connection_lost" | "status_unknown";

/** `loading`, `recovering` and `configuring` are the table's "boot", "recovering" and "bet panel being edited" conditions. */
export type LocalProgress = {
	request: LocalRequest;
	presentation: LocalPresentation;
	failure: LocalFailure;
	loading: boolean;
	recovering: boolean;
	configuring: boolean;
};

export type ClientState =
	| "LOADING"
	| "IDLE"
	| "CONFIGURING_BET"
	| "SUBMITTING_BET"
	| "ROUND_ACCEPTED"
	| "PRESENTATION_RUNNING"
	| "AWAITING_UPGRADE"
	| "AWAITING_RISK_CHOICE"
	| "RESOLVING_OUTCOME"
	| "OUTCOME_CONFIRMED"
	| "SETTLEMENT_PENDING"
	| "SETTLED"
	| "REQUEST_FAILED"
	| "CONNECTION_LOST"
	| "RECOVERING_ROUND"
	| "ROUND_STATUS_UNKNOWN";

export type MachineResult = { state: ClientState; outcomeConfirmed: boolean };

export const initialLocal: LocalProgress = {
	request: "none",
	presentation: "idle",
	failure: "none",
	loading: false,
	recovering: false,
	configuring: false
};

const result = (state: ClientState, outcomeConfirmed = false): MachineResult => ({ state, outcomeConfirmed });

/**
 * Client state from the server round and local progress (contract section 6). Presentation progress never moves the
 * state past what the server status allows. Combinations the table leaves open fall back to PRESENTATION_RUNNING
 * (the presentation has not caught up with the server).
 */
export function roundMachine(round: RoundRecord | null, local: LocalProgress): MachineResult {
	const outcomeConfirmed = round?.status === "resolved";
	if (local.loading) return result("LOADING");
	if (local.failure === "status_unknown") return result("ROUND_STATUS_UNKNOWN", outcomeConfirmed);
	if (local.recovering) return result("RECOVERING_ROUND", outcomeConfirmed);
	if (local.failure === "connection_lost") return result("CONNECTION_LOST", outcomeConfirmed);
	if (local.failure === "request_failed") return result("REQUEST_FAILED", outcomeConfirmed);

	if (!round) {
		if (local.request === "start") return result("SUBMITTING_BET");
		return result(local.configuring ? "CONFIGURING_BET" : "IDLE");
	}

	const { presentation } = local;
	switch (round.status) {
		case "accepted":
			return result("ROUND_ACCEPTED");
		case "running":
			return result(presentation === "finished" ? "RESOLVING_OUTCOME" : "PRESENTATION_RUNNING");
		case "awaiting_choice": {
			const atDecision = presentation === "at_decision" || presentation === "finished";
			if (!atDecision || !round.pendingDecision) return result("PRESENTATION_RUNNING");
			return result(round.pendingDecision.type === "upgrade" ? "AWAITING_UPGRADE" : "AWAITING_RISK_CHOICE");
		}
		case "resolved":
			if (presentation !== "finished") return result("PRESENTATION_RUNNING", true);
			return result(local.request === "settle" ? "SETTLEMENT_PENDING" : "OUTCOME_CONFIRMED", true);
		case "settled":
			return result(presentation === "finished" ? "SETTLED" : "PRESENTATION_RUNNING");
	}
}

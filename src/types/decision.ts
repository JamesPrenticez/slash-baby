export type DecisionOption = {
	id: string;
	title: string;
	description: string;
	visualTheme: string;
	resolutionRuleId: string;
};

export type DecisionPoint = {
	id: string; // this is the `decisionId` on the wire
	type: "upgrade" | "risk_reward";
	options: DecisionOption[];
	defaultOptionId?: string;
	timeoutPolicy: "default" | "pause" | "abort_if_permitted"; // the mock only uses "pause"
	outcomeEffect: "presentation_only" | "authoritative_resolution";
};

export type PlayerDecision = { roundId: string; decisionId: string; optionId: string; sequenceNumber: number };

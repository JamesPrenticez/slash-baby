import type { PresentationEvent, PresentationPlan } from "@/types/presentation";

export type SequencerStatus = "running" | "at_decision" | "finished" | "cancelled";
export type CompletionReason = "elapsed" | "signal" | "skipped";

export type SequencerState = {
	plan: PresentationPlan;
	/** Active event; equals `plan.events.length` once finished. */
	index: number;
	elapsedInEventMs: number;
	status: SequencerStatus;
};

export type SequencerTransition =
	| { kind: "start"; index: number; event: PresentationEvent }
	| { kind: "complete"; index: number; event: PresentationEvent; reason: CompletionReason }
	| { kind: "cancel"; index: number; event: PresentationEvent };

export type SequencerStep = { state: SequencerState; transitions: SequencerTransition[] };

/** A decision point has no duration: it waits for a signal (timeout policy `pause`). */
const durationOf = (event: PresentationEvent) => ("durationMs" in event ? Math.max(0, event.durationMs) : Infinity);

const isLive = (state: SequencerState) => state.status === "running" || state.status === "at_decision";

/** Enters event `index`, recording its start, and returns the state for it. */
function enter(
	plan: PresentationPlan,
	index: number,
	elapsedInEventMs: number,
	out: SequencerTransition[]
): SequencerState {
	const event = plan.events[index];
	if (!event) return { plan, index: plan.events.length, elapsedInEventMs: 0, status: "finished" };
	out.push({ kind: "start", index, event });
	return { plan, index, elapsedInEventMs, status: event.type === "decision_point" ? "at_decision" : "running" };
}

/** Begins a plan. Calling it again with the same plan is a restart. */
export function startSequence(plan: PresentationPlan): SequencerStep {
	const transitions: SequencerTransition[] = [];
	return { state: enter(plan, 0, 0, transitions), transitions };
}

/**
 * Moves time forward by `deltaMs` of plan time (already scaled by playback speed). Every timed event completes by
 * elapsed time alone, so a failed asset cannot stick the sequence. Leftover time carries into the next event.
 */
export function advance(state: SequencerState, deltaMs: number): SequencerStep {
	const transitions: SequencerTransition[] = [];
	if (state.status !== "running") return { state, transitions };
	let current: SequencerState = {
		...state,
		elapsedInEventMs: state.elapsedInEventMs + (Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0)
	};
	while (current.status === "running") {
		const event = current.plan.events[current.index];
		const duration = durationOf(event);
		if (current.elapsedInEventMs < duration) break;
		transitions.push({ kind: "complete", index: current.index, event, reason: "elapsed" });
		current = enter(current.plan, current.index + 1, current.elapsedInEventMs - duration, transitions);
	}
	return { state: current, transitions };
}

/** Ends the active event now: an external signal (a decision was made) or a skip (debug). */
export function completeActive(state: SequencerState, reason: "signal" | "skipped"): SequencerStep {
	const transitions: SequencerTransition[] = [];
	if (!isLive(state)) return { state, transitions };
	const event = state.plan.events[state.index];
	transitions.push({ kind: "complete", index: state.index, event, reason });
	return { state: enter(state.plan, state.index + 1, 0, transitions), transitions };
}

/** Stops the sequence. The active event, if any, is reported as cancelled; later `advance` calls do nothing. */
export function cancelSequence(state: SequencerState): SequencerStep {
	if (!isLive(state)) return { state, transitions: [] };
	const event = state.plan.events[state.index];
	return {
		state: { ...state, status: "cancelled" },
		transitions: [{ kind: "cancel", index: state.index, event }]
	};
}

import { create } from "zustand";

import type { PresentationEvent, PresentationPlan } from "@/types/presentation";
import {
	advance,
	cancelSequence,
	completeActive,
	type SequencerState,
	type SequencerStatus,
	type SequencerStep,
	type SequencerTransition,
	startSequence
} from "@/utils/eventSequencer";

export const LOG_LIMIT = 100;

export type LogEntry = SequencerTransition & { seq: number };

type PresentationStore = {
	plan: PresentationPlan | null;
	sequence: SequencerState | null;
	status: SequencerStatus | "idle";
	activeEvent: PresentationEvent | null;
	/** Index of the active event in the plan. */
	position: number;
	paused: boolean;
	playbackSpeed: number;
	log: LogEntry[];
	/** Starts (or restarts) a plan from its first event with a clean log. */
	play: (plan: PresentationPlan) => void;
	/** Advances by `deltaMS * playbackSpeed`. Does nothing while paused. Time is injected: no timers here. */
	tick: (deltaMS: number) => void;
	pause: () => void;
	resume: () => void;
	/** Ignored unless finite and above zero. Only scales time; nothing here knows about money. */
	setSpeed: (speed: number) => void;
	/** Moves forward by `deltaMS` of plan time even while paused (debug single-step). Scaled by the speed like `tick`. */
	step: (deltaMS: number) => void;
	/** Ends the active event now (debug). */
	skipEvent: () => void;
	/** External completion, e.g. a decision was made. */
	signalComplete: () => void;
	restart: () => void;
	/** Stops the plan and clears the active event. */
	cancel: () => void;
};

const initial = {
	plan: null,
	sequence: null,
	status: "idle",
	activeEvent: null,
	position: 0,
	paused: false,
	playbackSpeed: 1,
	log: []
} satisfies Partial<PresentationStore>;

let seq = 0;

export const usePresentationStore = create<PresentationStore>((set, get) => {
	const apply = ({ state, transitions }: SequencerStep, fresh = false) =>
		set(current => ({
			sequence: state,
			plan: state.plan,
			status: state.status,
			position: state.index,
			activeEvent: state.status === "cancelled" ? null : (state.plan.events[state.index] ?? null),
			log: [...(fresh ? [] : current.log), ...transitions.map(t => ({ ...t, seq: seq++ }))].slice(-LOG_LIMIT)
		}));

	const step = (run: (state: SequencerState) => SequencerStep) => {
		const { sequence } = get();
		if (sequence) apply(run(sequence));
	};

	return {
		...initial,
		play: plan => apply(startSequence(plan), true),
		tick: deltaMS => {
			const { paused, playbackSpeed } = get();
			if (!paused) step(state => advance(state, deltaMS * playbackSpeed));
		},
		pause: () => set({ paused: true }),
		resume: () => set({ paused: false }),
		setSpeed: speed => {
			if (Number.isFinite(speed) && speed > 0) set({ playbackSpeed: speed });
		},
		step: deltaMS => step(state => advance(state, deltaMS * get().playbackSpeed)),
		skipEvent: () => step(state => completeActive(state, "skipped")),
		signalComplete: () => step(state => completeActive(state, "signal")),
		restart: () => {
			const { plan } = get();
			if (plan) apply(startSequence(plan), true);
		},
		cancel: () => step(cancelSequence)
	};
});

/** Back to the idle store (tests, and a clean slate between rounds). */
export const resetPresentationStore = () => {
	seq = 0;
	usePresentationStore.setState({ ...initial });
};

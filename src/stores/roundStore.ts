import { create } from "zustand";

import { newIdempotencyKey } from "@/api/ids";
import type { RoundRecord } from "@/types/round";
import { initialLocal, type LocalProgress, type LocalRequest } from "@/utils/roundMachine";

export type PendingAction = { action: Exclude<LocalRequest, "none">; idempotencyKey: string };

/** The server round, local progress and the in-flight action. No network calls: callers use `src/api`. */
type RoundStore = {
	round: RoundRecord | null;
	local: LocalProgress;
	pending: PendingAction | null;
	/** Round whose results were already reached; a second settlement result for it is ignored. */
	resultsRoundId: string | null;

	/** Replace the round with a server snapshot. A settled round is applied once; returns false when ignored. */
	setRound: (round: RoundRecord | null) => boolean;
	setLocal: (patch: Partial<LocalProgress>) => void;
	/** Start an action. Repeating the same action (Retry) reuses its key. */
	beginAction: (action: PendingAction["action"]) => PendingAction;
	/** The request got an answer: clear the pending action and the failure. */
	completeAction: () => void;
	reset: () => void;
};

const empty = { round: null, local: initialLocal, pending: null, resultsRoundId: null };

export const useRoundStore = create<RoundStore>((set, get) => ({
	...empty,

	setRound: round => {
		if (round?.status === "settled") {
			if (get().resultsRoundId === round.roundId) return false;
			set({ round, resultsRoundId: round.roundId });
			return true;
		}
		set({ round });
		return true;
	},

	setLocal: patch => set(state => ({ local: { ...state.local, ...patch } })),

	beginAction: action => {
		const existing = get().pending;
		const pending = existing?.action === action ? existing : { action, idempotencyKey: newIdempotencyKey() };
		set(state => ({ pending, local: { ...state.local, request: action, failure: "none", recovering: false } }));
		return pending;
	},

	completeAction: () => set(state => ({ pending: null, local: { ...state.local, request: "none", failure: "none" } })),

	reset: () => set(empty)
}));

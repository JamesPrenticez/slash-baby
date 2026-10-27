import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/api/http";
import { settle, startRound } from "@/api/roundClient";
import { PRESENTATION_MAPS } from "@/constants/presentationMaps";
import { describeBootError } from "@/hooks/useGameSession";
import { usePresentationStore } from "@/stores/presentationStore";
import { type PendingAction, useRoundStore } from "@/stores/roundStore";
import { useWalletStore } from "@/stores/walletStore";
import type { PlayResponse } from "@/types/api";
import type { OutcomeCategory } from "@/types/round";
import { roundMachine } from "@/utils/roundMachine";

export type RoundError = { message: string; retryable: boolean };

/** Everything the results panel shows. All of it is the server's: nothing here is computed. */
export type RoundResults = { payoutMinorUnits: number; category: OutcomeCategory; balanceMinorUnits: number };

/**
 * A network error, a timeout and any 5xx may have been applied by the server, so they can be retried with the same key
 * (contract section 9). Every other 4xx is definite: nothing happened.
 */
const mayHaveApplied = (error: unknown) =>
	error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.status < 400);

type Phase = "idle" | "starting" | "presenting" | "settling" | "results";

/**
 * One round from PLAY to the results panel closing (BUILD-PLAN Phase 3): bet, `start`, the plan for the round's
 * `eventPlanId`, `settle`, results. This is the only place that sends `start` and `settle`. The client never decides or
 * computes an outcome or payout: balance, payout and category are what the server answered.
 */
export function useRound() {
	const round = useRoundStore(state => state.round);
	const local = useRoundStore(state => state.local);
	const pending = useRoundStore(state => state.pending);
	const balanceMinorUnits = useWalletStore(state => state.balanceMinorUnits);
	const [error, setError] = useState<RoundError | null>(null);
	const phase = useRef<Phase>("idle");

	const fail = useCallback((action: PendingAction["action"], cause: unknown) => {
		const store = useRoundStore.getState();
		const retryable = mayHaveApplied(cause);
		setError({ message: describeBootError(cause), retryable });
		if (retryable) {
			store.setLocal({ failure: "connection_lost" });
			return;
		}
		// A definite refusal: the pending key is spent. A refused `start` leaves PLAY available.
		store.completeAction();
		store.setLocal({ failure: "request_failed" });
		if (action === "start") phase.current = "idle";
	}, []);

	const accept = useCallback((response: PlayResponse) => {
		useRoundStore.getState().completeAction();
		useRoundStore.getState().setRound(response.message.round);
		useWalletStore.getState().setBalance(response.message.balanceMinorUnits);
	}, []);

	const submitSettle = useCallback(async () => {
		const store = useRoundStore.getState();
		const open = store.round;
		if (!open || open.status !== "resolved") return;
		const { idempotencyKey } = store.beginAction("settle");
		try {
			accept(await settle(open.roundId, idempotencyKey));
			phase.current = "results";
		} catch (cause) {
			fail("settle", cause);
		}
	}, [accept, fail]);

	const startPresentation = useCallback(() => {
		const { round: open } = useRoundStore.getState();
		if (!open) return;
		const plan = PRESENTATION_MAPS[open.eventPlanId] ?? PRESENTATION_MAPS.plan_loss;
		phase.current = "presenting";
		useRoundStore.getState().setLocal({ presentation: "running" });
		usePresentationStore.getState().play(plan);
	}, []);

	const submitStart = useCallback(async () => {
		const { idempotencyKey } = useRoundStore.getState().beginAction("start");
		try {
			accept(await startRound(useWalletStore.getState().betMinorUnits, idempotencyKey));
			startPresentation();
		} catch (cause) {
			fail("start", cause);
		}
	}, [accept, fail, startPresentation]);

	// The presentation ending (or being cancelled from the debug menu) is the only thing that moves a round to settle.
	useEffect(
		() =>
			usePresentationStore.subscribe(({ status }) => {
				if (phase.current !== "presenting" || (status !== "finished" && status !== "cancelled")) return;
				phase.current = "settling";
				useRoundStore.getState().setLocal({ presentation: "finished" });
				void submitSettle();
			}),
		[submitSettle]
	);

	/** Starts a round. Ignored while one is in flight, so a double click is one round. */
	const play = useCallback(() => {
		if (phase.current !== "idle") return;
		phase.current = "starting";
		setError(null);
		void submitStart();
	}, [submitStart]);

	/** Resends the failed request with the same idempotency key. */
	const retry = useCallback(() => {
		const action = useRoundStore.getState().pending?.action;
		setError(null);
		if (action === "start") void submitStart();
		else if (action === "settle") void submitSettle();
	}, [submitStart, submitSettle]);

	/** Closes the results and returns to the bet screen. */
	const close = useCallback(() => {
		phase.current = "idle";
		setError(null);
		useRoundStore.getState().reset();
	}, []);

	const { state } = roundMachine(round, local);
	const results: RoundResults | null =
		state === "SETTLED" && round?.settlement && round.outcome
			? {
					payoutMinorUnits: round.settlement.payoutMinorUnits,
					category: round.outcome.category,
					balanceMinorUnits
				}
			: null;

	return {
		/** The bet is locked and PLAY ignores presses from the press until the results close (U-20). */
		busy: round !== null || pending !== null,
		results,
		error,
		play,
		retry,
		close
	};
}

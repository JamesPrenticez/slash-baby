import { useCallback, useEffect, useState } from "react";

import { ApiError, bootstrapSession } from "@/api/http";
import { newIdempotencyKey } from "@/api/ids";
import { getCurrent, settle } from "@/api/roundClient";
import { useWalletStore } from "@/stores/walletStore";

export type GameSession = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/** The text for the error screen. A server that cannot be reached is said so; anything else keeps the server's words. */
export function describeBootError(error: unknown): string {
	if (error instanceof ApiError && (error.code === "network_error" || error.code === "timeout")) {
		return "The game server could not be reached. Check your connection and try again.";
	}
	return error instanceof Error ? error.message : String(error);
}

/**
 * Boots the session (contract section 9): `session`, then `current`. A round the server has `resolved` but not settled is
 * settled here, before the game is ready (decision U-23), and the balance on screen is the one the server last answered.
 * A round in any other status is not resumed yet (W7, W8). `retry` runs the sequence again from the loading state.
 */
export function useGameSession(): GameSession & { retry: () => void } {
	const [state, setState] = useState<GameSession>({ status: "loading" });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let live = true;
		bootstrapSession()
			.then(async session => {
				const current = await getCurrent();
				const balanceMinorUnits =
					current.active && current.round.status === "resolved"
						? (await settle(current.round.roundId, newIdempotencyKey())).message.balanceMinorUnits
						: current.balanceMinorUnits;
				if (!live) return;
				useWalletStore.getState().setSession({ ...session, balanceMinorUnits });
				setState({ status: "ready" });
			})
			.catch((error: unknown) => live && setState({ status: "error", message: describeBootError(error) }));
		return () => {
			live = false;
		};
	}, [attempt]);

	const retry = useCallback(() => {
		setState({ status: "loading" });
		setAttempt(n => n + 1);
	}, []);

	return { ...state, retry };
}

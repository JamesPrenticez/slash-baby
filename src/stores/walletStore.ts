import { create } from "zustand";

import type { GameConfig, SessionResponse } from "@/types/api";

/** What the server said about the player. Every amount is integer minor units and comes from a server reply. */
type WalletStore = {
	config: GameConfig | null;
	playerId: string;
	currency: string;
	balanceMinorUnits: number;
	/** The wager the bet control shows. Only a choice of the player: the server validates it again at `start`. */
	betMinorUnits: number;

	/** A fresh session: config, player and the balance it carries. The bet is kept if the new limits still hold it. */
	setSession: (session: SessionResponse) => void;
	setBalance: (balanceMinorUnits: number) => void;
	setBet: (betMinorUnits: number) => void;
	reset: () => void;
};

const empty = { config: null, playerId: "", currency: "", balanceMinorUnits: 0, betMinorUnits: 0 };

export const useWalletStore = create<WalletStore>((set, get) => ({
	...empty,

	setSession: ({ playerId, balanceMinorUnits, config }) => {
		const kept = get().betMinorUnits;
		const keep = kept >= config.minWagerMinorUnits && kept <= config.maxWagerMinorUnits;
		set({
			config,
			playerId,
			currency: config.currency,
			balanceMinorUnits,
			betMinorUnits: keep ? kept : config.defaultWagerMinorUnits
		});
	},

	setBalance: balanceMinorUnits => set({ balanceMinorUnits }),
	setBet: betMinorUnits => set({ betMinorUnits }),
	reset: () => set(empty)
}));

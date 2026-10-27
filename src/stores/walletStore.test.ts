import { sessionBody } from "@/utils/testFetch";

import { useWalletStore } from "./walletStore";

beforeEach(() => useWalletStore.getState().reset());

describe("walletStore", () => {
	it("starts without a session", () => {
		const { config, balanceMinorUnits, betMinorUnits } = useWalletStore.getState();
		expect(config).toBeNull();
		expect(balanceMinorUnits).toBe(0);
		expect(betMinorUnits).toBe(0);
	});

	it("setSession keeps the config, player and currency, and starts the bet at the default wager", () => {
		useWalletStore.getState().setSession(sessionBody("t", "JPY"));
		const state = useWalletStore.getState();
		expect(state.config?.currency).toBe("JPY");
		expect(state.currency).toBe("JPY");
		expect(state.playerId).toBe("anon:test");
		expect(state.balanceMinorUnits).toBe(100000);
		expect(state.betMinorUnits).toBe(100);
	});

	it("a new session for the same player keeps a bet that is still inside the limits", () => {
		useWalletStore.getState().setSession(sessionBody());
		useWalletStore.getState().setBet(1000);
		useWalletStore.getState().setSession(sessionBody("t2", "EUR"));
		expect(useWalletStore.getState().betMinorUnits).toBe(1000);
	});

	it("setBalance replaces the balance with the server's value", () => {
		useWalletStore.getState().setBalance(1234);
		expect(useWalletStore.getState().balanceMinorUnits).toBe(1234);
	});

	it("reset forgets everything", () => {
		useWalletStore.getState().setSession(sessionBody());
		useWalletStore.getState().reset();
		expect(useWalletStore.getState().config).toBeNull();
	});
});

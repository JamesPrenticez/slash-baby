import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
	creditBalance,
	expireSession,
	getDebugPlayerId,
	getDebugState,
	resetPlayer,
	setBalance,
	switchCurrency
} from "@/api/debug";
import { ApiError } from "@/api/http";
import { getBalance } from "@/api/roundClient";
import { useWalletStore } from "@/stores/walletStore";
import type { DebugState } from "@/types/debug";
import { sessionBody } from "@/utils/testFetch";

import { SessionSection } from "./SessionSection";

vi.mock("@/api/debug");
vi.mock("@/api/roundClient", () => ({ getBalance: vi.fn() }));

const currencies = [
	{ code: "USD", minorUnitExponent: 2 },
	{ code: "JPY", minorUnitExponent: 0 }
];

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(getDebugPlayerId).mockReturnValue("tester-abcd1234");
	vi.mocked(getDebugState).mockResolvedValue({ currencies } as DebugState);
	useWalletStore.getState().reset();
	useWalletStore.getState().setSession(sessionBody());
});

const stateOf = () => useWalletStore.getState();

describe("SessionSection", () => {
	it("labels the server as a mock and shows the contract version, player and balance in minor units", () => {
		render(<SessionSection />);
		expect(screen.getByText("MOCK")).toBeInTheDocument();
		expect(screen.getByText("0.2")).toBeInTheDocument();
		expect(screen.getByText("anon:test")).toBeInTheDocument();
		expect(screen.getByText("tester-abcd1234")).toBeInTheDocument();
		expect(screen.getByText("100000 (USD, exp 2)")).toBeInTheDocument();
	});

	it("sets the balance to the typed amount and shows what the server answers", async () => {
		vi.mocked(setBalance).mockResolvedValue({ balanceMinorUnits: 777, currency: "USD" });
		render(<SessionSection />);
		const input = screen.getByRole("spinbutton", { name: "Balance (minor units)" });
		await userEvent.clear(input);
		await userEvent.type(input, "777");
		await userEvent.click(screen.getByRole("button", { name: "Set balance" }));
		expect(setBalance).toHaveBeenCalledWith(777);
		await waitFor(() => expect(stateOf().balanceMinorUnits).toBe(777));
	});

	it("credits the default amount, or the typed one", async () => {
		vi.mocked(creditBalance).mockResolvedValue({ balanceMinorUnits: 5, currency: "USD" });
		render(<SessionSection />);
		await userEvent.click(screen.getByRole("button", { name: "Credit" }));
		expect(creditBalance).toHaveBeenLastCalledWith(undefined);
		await waitFor(() => expect(stateOf().balanceMinorUnits).toBe(5));

		await userEvent.type(screen.getByRole("spinbutton", { name: "Credit (minor units)" }), "250");
		await userEvent.click(screen.getByRole("button", { name: "Credit" }));
		expect(creditBalance).toHaveBeenLastCalledWith(250);
	});

	it("switches the currency and takes the new session", async () => {
		vi.mocked(switchCurrency).mockResolvedValue({
			...sessionBody("t", "JPY"),
			config: { ...sessionBody().config, currency: "JPY", minorUnitExponent: 0 }
		});
		render(<SessionSection />);
		await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Currency" }), "JPY");
		await userEvent.click(screen.getByRole("button", { name: "Switch currency" }));
		expect(switchCurrency).toHaveBeenCalledWith("JPY");
		await waitFor(() => expect(stateOf().currency).toBe("JPY"));
	});

	it("reports a refused action instead of changing anything", async () => {
		vi.mocked(switchCurrency).mockRejectedValue(new ApiError(409, "round_already_started", "round open"));
		render(<SessionSection />);
		await userEvent.click(screen.getByRole("button", { name: "Switch currency" }));
		expect(await screen.findByRole("status")).toHaveTextContent("round_already_started");
		expect(stateOf().currency).toBe("USD");
	});

	it("expires the session without touching the balance", async () => {
		vi.mocked(expireSession).mockResolvedValue({ ok: true });
		render(<SessionSection />);
		await userEvent.click(screen.getByRole("button", { name: "Expire session" }));
		expect(expireSession).toHaveBeenCalled();
		expect(stateOf().balanceMinorUnits).toBe(100000);
	});

	it("resets the player, then reads the restored balance", async () => {
		vi.mocked(resetPlayer).mockResolvedValue({} as DebugState);
		vi.mocked(getBalance).mockResolvedValue({ balanceMinorUnits: 100000, currency: "USD" });
		useWalletStore.getState().setBalance(3);
		render(<SessionSection />);
		await userEvent.click(screen.getByRole("button", { name: "Reset player" }));
		await waitFor(() => expect(stateOf().balanceMinorUnits).toBe(100000));
	});
});

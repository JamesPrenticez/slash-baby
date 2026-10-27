import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useGameSession } from "@/hooks/useGameSession";

import App from "./App";

// Pixi needs WebGL, which happy-dom lacks; the session and the UI around the canvas are what App owns.
vi.mock("@/components/GameCanvas", () => ({ GameCanvas: () => <div data-testid="canvas" /> }));
vi.mock("@/components/UserInterface", () => ({ UserInterface: () => <div data-testid="ui" /> }));
vi.mock("@/hooks/useGameSession");

const retry = vi.fn();
const session = (state: ReturnType<typeof useGameSession>) => vi.mocked(useGameSession).mockReturnValue(state);

describe("App", () => {
	it("shows only the loading screen while the session boots", () => {
		session({ status: "loading", retry });
		render(<App />);
		expect(screen.getByRole("progressbar", { name: "Loading" })).toBeInTheDocument();
		expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
		expect(screen.queryByTestId("ui")).not.toBeInTheDocument();
	});

	it("shows the error with a Retry that boots again, and no game behind it", async () => {
		session({ status: "error", message: "The game server could not be reached.", retry });
		render(<App />);
		expect(screen.getByRole("alert")).toHaveTextContent("The game server could not be reached.");
		expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(retry).toHaveBeenCalledOnce();
	});

	it("mounts the canvas and the UI once the session is ready", () => {
		session({ status: "ready", retry });
		render(<App />);
		expect(screen.getByTestId("canvas")).toBeInTheDocument();
		expect(screen.getByTestId("ui")).toBeInTheDocument();
	});
});

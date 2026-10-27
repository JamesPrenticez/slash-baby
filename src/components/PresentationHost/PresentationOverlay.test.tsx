import { act, render, screen } from "@testing-library/react";

import { PRESENTATION_MAPS } from "@/constants/presentationMaps";
import { resetPresentationStore, usePresentationStore } from "@/stores/presentationStore";

import { PresentationOverlay } from "./PresentationOverlay";

beforeEach(resetPresentationStore);

describe("PresentationOverlay", () => {
	it("shows only while outcome_reveal is the active event", () => {
		render(<PresentationOverlay />);
		expect(screen.queryByTestId("presentation-overlay")).not.toBeInTheDocument();

		act(() => usePresentationStore.getState().play(PRESENTATION_MAPS.plan_loss));
		expect(screen.queryByTestId("presentation-overlay")).not.toBeInTheDocument();

		act(() => usePresentationStore.getState().tick(4500));
		expect(screen.getByTestId("presentation-overlay")).toHaveTextContent("Outcome reveal");

		act(() => usePresentationStore.getState().tick(1000));
		expect(screen.queryByTestId("presentation-overlay")).not.toBeInTheDocument();
	});
});

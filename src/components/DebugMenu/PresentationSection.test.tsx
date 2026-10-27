import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PLAN_DEMO } from "@/constants/presentationMaps";
import { resetPresentationStore, usePresentationStore } from "@/stores/presentationStore";
import { probe, resetProbe } from "@/utils/debugProbe";

import { PresentationSection } from "./PresentationSection";

const store = () => usePresentationStore.getState();
const press = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const text = (id: string) => screen.getByTestId(id);

beforeEach(() => {
	resetPresentationStore();
	resetProbe();
});

describe("PresentationSection", () => {
	it("reads idle before anything plays", () => {
		render(<PresentationSection />);
		expect(text("presentation-status")).toHaveTextContent("idle");
		expect(text("presentation-active")).toHaveTextContent("—");
		expect(text("presentation-position")).toHaveTextContent("—");
	});

	it("plays the demo plan and shows the active event, position and log", async () => {
		render(<PresentationSection />);
		await press("Play demo plan");
		expect(store().plan?.planId).toBe(PLAN_DEMO.planId);
		expect(text("presentation-plan")).toHaveTextContent("plan_demo");
		expect(text("presentation-active")).toHaveTextContent("run_intro");
		expect(text("presentation-position")).toHaveTextContent("0/3");
		expect(within(text("presentation-log")).getAllByRole("listitem")).toHaveLength(1);
	});

	it("pauses, single-steps, skips, restarts and cancels", async () => {
		render(<PresentationSection />);
		await press("Play demo plan");

		await press("Pause");
		expect(store().paused).toBe(true);
		expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-pressed", "true");
		await press("Step");
		expect(store().sequence?.elapsedInEventMs).toBe(100);
		await press("Resume");
		expect(store().paused).toBe(false);

		await press("Skip event");
		expect(text("presentation-active")).toHaveTextContent("coin_trail");

		await press("Restart");
		expect(text("presentation-active")).toHaveTextContent("run_intro");

		await press("Cancel");
		expect(text("presentation-status")).toHaveTextContent("cancelled");
		expect(text("presentation-active")).toHaveTextContent("—");
	});

	it("sets the playback speed", async () => {
		render(<PresentationSection />);
		await press("x4");
		expect(store().playbackSpeed).toBe(4);
		expect(text("presentation-speed")).toHaveTextContent("x4");
		expect(screen.getByRole("button", { name: "x4" })).toHaveAttribute("aria-pressed", "true");
	});

	it("fires a single event as a one-event plan", async () => {
		render(<PresentationSection />);
		await press("monster_wave");
		expect(store().plan?.events.map(e => e.type)).toEqual(["monster_wave"]);
		expect(text("presentation-position")).toHaveTextContent("0/1");
	});

	it("toggles the forced asset failure", async () => {
		render(<PresentationSection />);
		await press("Fail assets");
		expect(probe.failAssets).toBe(true);
		expect(screen.getByRole("button", { name: "Fail assets" })).toHaveAttribute("aria-pressed", "true");
		await press("Fail assets");
		expect(probe.failAssets).toBe(false);
	});
});

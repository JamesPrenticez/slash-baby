import { Profiler } from "react";
import { act, render, screen } from "@testing-library/react";
import { Ticker } from "pixi.js";

import { probe, resetProbe } from "@/utils/debugProbe";

import { Readouts } from "./Readouts";

const value = (label: string) => screen.getByText(label).nextElementSibling;

describe("Readouts", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetProbe();
	});
	afterEach(() => {
		vi.useRealTimers();
		document.querySelectorAll("canvas").forEach(canvas => canvas.remove());
	});

	it("fills in on mount, then refreshes four times a second", () => {
		render(<Readouts />);
		expect(value("React commits")).toHaveTextContent("0");

		probe.commits = 5;
		act(() => {
			vi.advanceTimersByTime(249);
		});
		expect(value("React commits")).toHaveTextContent("0");

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(value("React commits")).toHaveTextContent("5");
	});

	it("never re-renders to do it", () => {
		const onRender = vi.fn();
		render(
			<Profiler id="readouts" onRender={onRender}>
				<Readouts />
			</Profiler>
		);
		const afterMount = onRender.mock.calls.length;

		probe.scrollX = 100;
		act(() => {
			vi.advanceTimersByTime(1000);
		});

		expect(value("scrollX (px)")).toHaveTextContent("100");
		expect(onRender).toHaveBeenCalledTimes(afterMount);
	});

	it("counts the canvases in the document and the shared ticker's listeners", () => {
		document.body.append(document.createElement("canvas"), document.createElement("canvas"));
		render(<Readouts />);
		expect(value("canvases")).toHaveTextContent("2");
		expect(value("shared ticker listeners")).toHaveTextContent(String(Ticker.shared.count));
	});

	it("stops its timer on unmount", () => {
		const { unmount } = render(<Readouts />);
		expect(vi.getTimerCount()).toBe(1);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});

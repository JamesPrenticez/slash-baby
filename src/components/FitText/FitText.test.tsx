import { render, screen } from "@testing-library/react";

import { FitText } from "./FitText";

type ObserverStub = { callback: ResizeObserverCallback; observed: Element[]; disconnected: boolean };
let observers: ObserverStub[] = [];

beforeEach(() => {
	observers = [];
	vi.stubGlobal(
		"ResizeObserver",
		class {
			stub: ObserverStub;
			constructor(callback: ResizeObserverCallback) {
				this.stub = { callback, observed: [], disconnected: false };
				observers.push(this.stub);
			}
			observe(element: Element) {
				this.stub.observed.push(element);
			}
			unobserve() {}
			disconnect() {
				this.stub.disconnected = true;
			}
		}
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** happy-dom does no layout, so the widths a browser would measure are set by hand. */
function setWidths(text: HTMLElement, { box, natural }: { box: number; natural: number }) {
	const boxElement = text.parentElement as HTMLElement;
	Object.defineProperty(boxElement, "clientWidth", { configurable: true, value: box });
	Object.defineProperty(text, "scrollWidth", { configurable: true, value: natural });
}

const remeasure = () => observers.forEach(({ callback }) => callback([], {} as ResizeObserver));

describe("FitText", () => {
	it("renders its children on a single line", () => {
		render(<FitText>$1,000.00</FitText>);
		expect(screen.getByText("$1,000.00")).toBeInTheDocument();
	});

	it("shrinks text that is wider than its box", () => {
		render(<FitText>$999,999,999.99</FitText>);
		const text = screen.getByText("$999,999,999.99");
		setWidths(text, { box: 100, natural: 200 });
		remeasure();
		expect(text.style.transform).toBe("scale(0.5)");
	});

	it("never scales above 1, however roomy the box", () => {
		render(<FitText>$1</FitText>);
		const text = screen.getByText("$1");
		setWidths(text, { box: 500, natural: 20 });
		remeasure();
		expect(text.style.transform).toBe("");
	});

	it("takes the box padding off the room the text gets", () => {
		render(<FitText className="padded">$1,000.00</FitText>);
		const text = screen.getByText("$1,000.00");
		const box = text.parentElement as HTMLElement;
		box.style.paddingLeft = "10px";
		box.style.paddingRight = "30px";
		setWidths(text, { box: 140, natural: 200 });
		remeasure();
		expect(text.style.transform).toBe("scale(0.5)");
	});

	it("grows back when the box gets roomier", () => {
		render(<FitText>$999,999,999.99</FitText>);
		const text = screen.getByText("$999,999,999.99");
		setWidths(text, { box: 100, natural: 200 });
		remeasure();
		expect(text.style.transform).not.toBe("");
		setWidths(text, { box: 300, natural: 200 });
		remeasure();
		expect(text.style.transform).toBe("");
	});

	it("observes the box and the text, and stops on unmount", () => {
		const { unmount } = render(<FitText>$1</FitText>);
		const text = screen.getByText("$1");
		expect(observers).toHaveLength(1);
		expect(observers[0].observed).toEqual([text.parentElement, text]);
		unmount();
		expect(observers[0].disconnected).toBe(true);
	});

	it("passes align and className to the box", () => {
		render(
			<FitText align="start" className="mine">
				$1
			</FitText>
		);
		const box = screen.getByText("$1").parentElement as HTMLElement;
		expect(box).toHaveAttribute("data-align", "start");
		expect(box).toHaveClass("mine");
	});

	it("still renders where ResizeObserver does not exist", () => {
		vi.stubGlobal("ResizeObserver", undefined);
		render(<FitText>$1</FitText>);
		expect(screen.getByText("$1")).toBeInTheDocument();
	});
});

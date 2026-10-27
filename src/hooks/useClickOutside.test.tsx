import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useClickOutside } from "./useClickOutside";

function Probe({ onOutside }: { onOutside: () => void }) {
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, onOutside);
	return (
		<div>
			<div ref={ref}>
				<button type="button">inside</button>
			</div>
			<button type="button">outside</button>
			<div data-ignore-click-away>
				<button type="button">ignored</button>
			</div>
		</div>
	);
}

describe("useClickOutside", () => {
	it("fires for a press outside the element", async () => {
		const onOutside = vi.fn();
		render(<Probe onOutside={onOutside} />);
		await userEvent.click(screen.getByRole("button", { name: "outside" }));
		expect(onOutside).toHaveBeenCalledOnce();
	});

	it("does not fire for a press inside, or inside a data-ignore-click-away region", async () => {
		const onOutside = vi.fn();
		render(<Probe onOutside={onOutside} />);
		await userEvent.click(screen.getByRole("button", { name: "inside" }));
		await userEvent.click(screen.getByRole("button", { name: "ignored" }));
		expect(onOutside).not.toHaveBeenCalled();
	});

	it("ignores a press whose target is not an element, such as the document itself", () => {
		const onOutside = vi.fn();
		render(<Probe onOutside={onOutside} />);
		fireEvent.mouseDown(document);
		expect(onOutside).not.toHaveBeenCalled();
	});

	it("does nothing while the ref is not attached", async () => {
		const onOutside = vi.fn();
		function Detached() {
			const ref = useRef<HTMLDivElement>(null);
			useClickOutside(ref, onOutside);
			return <button type="button">outside</button>;
		}
		render(<Detached />);
		await userEvent.click(screen.getByRole("button", { name: "outside" }));
		expect(onOutside).not.toHaveBeenCalled();
	});

	it("stops listening after unmount", async () => {
		const onOutside = vi.fn();
		const { unmount } = render(
			<>
				<Probe onOutside={onOutside} />
				<button type="button">elsewhere</button>
			</>
		);
		const elsewhere = screen.getByRole("button", { name: "elsewhere" });
		unmount();
		document.body.append(elsewhere);
		await userEvent.click(elsewhere);
		expect(onOutside).not.toHaveBeenCalled();
	});
});

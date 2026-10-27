import { type RefObject, useEffect } from "react";

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Overlays can stack; only the topmost traps.
const stack: HTMLElement[] = [];

const focusableIn = (el: HTMLElement) =>
	[...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(node => node.checkVisibility?.() ?? true);

/**
 * While `active`, moves focus into `ref` and keeps Tab and Shift+Tab inside it. On deactivation or unmount,
 * focus returns to whatever held it before. Give the element `tabIndex={-1}` so it can hold focus when it
 * has no focusable child.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
	useEffect(() => {
		const el = ref.current;
		if (!active || !el) return;
		const opener = document.activeElement;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Tab" || stack.at(-1) !== el) return;
			const items = focusableIn(el);
			const first = items[0];
			const last = items.at(-1);
			if (!first || !last) {
				event.preventDefault();
				return;
			}
			const current = document.activeElement;
			const atEdge = event.shiftKey ? current === first || current === el : current === last;
			if (!el.contains(current) || atEdge) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			}
		};

		stack.push(el);
		(focusableIn(el)[0] ?? el).focus();
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			stack.splice(stack.indexOf(el), 1);
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}, [ref, active]);
}

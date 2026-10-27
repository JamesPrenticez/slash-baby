import { type ReactNode, useLayoutEffect, useRef } from "react";

import { fitScale } from "./fitScale";
import styles from "./FitText.module.css";

export type FitTextProps = {
	children?: ReactNode;
	/** Applied to the box. Style the text through the colour and font it inherits. */
	className?: string;
	/** Which edge a shrunk line stays anchored to. */
	align?: "start" | "center";
};

/**
 * One line of text that shrinks (never grows) to fit the width of its box, so a very long amount stays on one line
 * inside its slot instead of overflowing or wrapping. Re-measures when the box resizes and when the text does, so a
 * late web-font swap that widens the text is caught. The scale is written straight to the DOM, with no React render.
 */
export function FitText({ children, className, align = "center" }: FitTextProps) {
	const boxRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);

	useLayoutEffect(() => {
		const box = boxRef.current;
		const text = textRef.current;
		if (!box || !text) return;

		const measure = () => {
			// clientWidth includes padding, the text only gets the content box. Number.parseFloat reads a pixel
			// padding here and never money (TEAM 14).
			const { paddingLeft, paddingRight } = getComputedStyle(box);
			const available =
				box.clientWidth - (Number.parseFloat(paddingLeft) || 0) - (Number.parseFloat(paddingRight) || 0);
			// scrollWidth is the layout width and ignores the transform, so applying the scale cannot feed back.
			const scale = fitScale(available, text.scrollWidth);
			text.style.transform = scale < 1 ? `scale(${scale})` : "";
		};

		measure();
		if (typeof ResizeObserver === "undefined") return;

		// The text is observed as well as the box: a font swap widens the text without resizing the box.
		const observer = new ResizeObserver(measure);
		observer.observe(box);
		observer.observe(text);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={boxRef} className={className ? `${styles.fit} ${className}` : styles.fit} data-align={align}>
			<span ref={textRef} className={styles.text}>
				{children}
			</span>
		</div>
	);
}

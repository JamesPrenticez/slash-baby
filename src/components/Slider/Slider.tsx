import type { ComponentProps, CSSProperties } from "react";

import styles from "./Slider.module.css";

export type SliderProps = Omit<
	ComponentProps<"input">,
	"type" | "value" | "onChange" | "min" | "max" | "step" | "className" | "aria-label"
> & {
	/** The only label a bare slider has. */
	"aria-label": string;
	/** From 0 to 1. */
	value: number;
	onValueChange: (value: number) => void;
	/** Applied to the wrapper; every other prop goes to the range input. */
	className?: string;
};

export function Slider({ value, onValueChange, className, ...props }: SliderProps) {
	const fill = Math.min(1, Math.max(0, value)) * 100;

	return (
		<div
			className={className ? `${styles.slider} ${className}` : styles.slider}
			style={{ "--slider-fill": `${fill}%` } as CSSProperties}
		>
			<div className={styles.track} />
			<div className={styles.fill} />
			<input
				{...props}
				className={styles.input}
				type="range"
				min={0}
				max={1}
				step={0.01}
				value={value}
				onChange={event => onValueChange(event.currentTarget.valueAsNumber)}
			/>
			<div className={styles.thumb} />
		</div>
	);
}

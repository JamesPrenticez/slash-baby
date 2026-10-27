import type { ComponentProps } from "react";

import styles from "./Toggle.module.css";

export type ToggleProps = Omit<ComponentProps<"button">, "value" | "role" | "children"> & {
	value: boolean;
	onValueChange: (value: boolean) => void;
};

/** A switch. Give it an accessible name with `aria-label` or `aria-labelledby`. */
export function Toggle({ value, onValueChange, onClick, className, ...props }: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={value}
			className={className ? `${styles.track} ${className}` : styles.track}
			{...props}
			onClick={event => {
				onClick?.(event);
				onValueChange(!value);
			}}
		>
			<span className={styles.thumb} />
		</button>
	);
}

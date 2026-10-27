import type { ComponentProps } from "react";

import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "negative" | "outline";

export type ButtonProps = ComponentProps<"button"> & {
	variant?: ButtonVariant;
};

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
	return (
		<button
			type={type}
			data-variant={variant}
			className={className ? `${styles.button} ${className}` : styles.button}
			{...props}
		/>
	);
}

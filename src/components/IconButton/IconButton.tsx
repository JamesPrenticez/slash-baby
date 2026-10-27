import type { ComponentProps } from "react";

import styles from "./IconButton.module.css";

export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label"> & {
	/** An icon-only button has no text, so the name is required. */
	"aria-label": string;
	/** Renders the pressed state (`aria-pressed`). Leave undefined for a plain action button. */
	active?: boolean;
};

export function IconButton({ active, className, type = "button", ...props }: IconButtonProps) {
	return (
		<button
			type={type}
			aria-pressed={active}
			className={className ? `${styles.button} ${className}` : styles.button}
			{...props}
		/>
	);
}

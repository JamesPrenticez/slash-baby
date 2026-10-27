import type { ComponentProps } from "react";

import XIcon from "@/assets/icons/x.svg?react";

import styles from "./CloseButton.module.css";

export type CloseButtonProps = Omit<ComponentProps<"button">, "children">;

export function CloseButton({ className, type = "button", ...props }: CloseButtonProps) {
	return (
		<button
			type={type}
			aria-label="Close"
			className={className ? `${styles.button} ${className}` : styles.button}
			{...props}
		>
			<XIcon aria-hidden="true" />
		</button>
	);
}

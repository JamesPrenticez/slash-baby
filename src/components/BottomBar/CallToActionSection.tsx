import { Button } from "@/components/Button";

import styles from "./CallToActionSection.module.css";

/** idle: can be pressed. busy: a request or round is in flight. disabled: cannot start now (for example no balance). */
export type CallToActionState = "idle" | "busy" | "disabled";

export type CallToActionSectionProps = {
	state: CallToActionState;
	/** Left out until a round can be started. */
	onClick?: () => void;
};

/** The main button of the bar. */
export function CallToActionSection({ state, onClick }: CallToActionSectionProps) {
	return (
		<div className={styles.cta}>
			<Button
				variant="primary"
				className={styles.button}
				disabled={state !== "idle"}
				aria-busy={state === "busy" || undefined}
				onClick={onClick}
			>
				PLAY
			</Button>
		</div>
	);
}

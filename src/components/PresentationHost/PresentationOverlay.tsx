import { usePresentationStore } from "@/stores/presentationStore";

import styles from "./PresentationOverlay.module.css";

/** The placeholder outcome reveal: a caption over the canvas while `outcome_reveal` is the active event. */
export function PresentationOverlay() {
	const event = usePresentationStore(state => state.activeEvent);
	if (event?.type !== "outcome_reveal") return null;
	return (
		<div className={styles.overlay} role="status" data-testid="presentation-overlay">
			<p className={styles.caption}>Outcome reveal</p>
		</div>
	);
}

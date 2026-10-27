import { useId, useRef } from "react";

import { Button } from "@/components/Button";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { OutcomeCategory } from "@/types/round";
import { formatMoney } from "@/utils/formatMoney";

import styles from "./ResultsPanel.module.css";

export type ResultsPanelProps = {
	/** The server's payout for the round, in minor units. */
	payoutMinorUnits: number;
	/** The server's category for the round. */
	category: OutcomeCategory;
	/** The balance after settlement, from the server's reply. */
	balanceMinorUnits: number;
	currency: string;
	minorUnitExponent: number;
	onContinue: () => void;
};

/** `small_win` as `Small win`. A label only: the id is the server's. */
const categoryLabel = (category: OutcomeCategory) => {
	const words = category.replaceAll("_", " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The end of a round: the server's category, payout and new balance, and one Continue button. No other way to close it,
 * and nothing dismisses it. Not built on `Modal` for that reason: Modal also closes on Escape and on a backdrop click.
 */
export function ResultsPanel({
	payoutMinorUnits,
	category,
	balanceMinorUnits,
	currency,
	minorUnitExponent,
	onContinue
}: ResultsPanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const titleId = useId();
	useFocusTrap(panelRef);
	const money = (minor: number) => formatMoney(minor, minorUnitExponent, currency);

	return (
		<div className={styles.overlay}>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				className={styles.panel}
			>
				<h2 id={titleId} className={styles.category} data-category={category}>
					{categoryLabel(category)}
				</h2>
				<dl className={styles.figures}>
					<div className={styles.figure}>
						<dt className={styles.label}>Payout</dt>
						<dd className={styles.payout}>{money(payoutMinorUnits)}</dd>
					</div>
					<div className={styles.figure}>
						<dt className={styles.label}>Balance</dt>
						<dd className={styles.balance}>{money(balanceMinorUnits)}</dd>
					</div>
				</dl>
				<Button className={styles.continue} onClick={onContinue}>
					Continue
				</Button>
			</div>
		</div>
	);
}

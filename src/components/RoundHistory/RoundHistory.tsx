import PillBackground from "@/assets/historyPill.svg?react";
import type { HistoryEntry } from "@/types/round";
import { formatMoney } from "@/utils/formatMoney";

import styles from "./RoundHistory.module.css";

/** NGU shows its last six rounds. */
const MAX_VISIBLE = 6;

export type RoundHistoryProps = {
	/** Settled rounds, newest first, as `GET /api/game/history` returns them. */
	entries: HistoryEntry[];
	/** Decimal places of the entries' currency (`GameConfig.minorUnitExponent`). */
	minorUnitExponent: number;
};

/** The recent-results strip. Each pill shows the server's payout for a settled round; the newest sits rightmost. */
export function RoundHistory({ entries, minorUnitExponent }: RoundHistoryProps) {
	if (entries.length === 0) return null;

	return (
		<ul className={styles.strip} aria-label="Recent rounds">
			{entries.slice(0, MAX_VISIBLE).map(entry => (
				<li key={entry.roundId} className={styles.pill} data-category={entry.category}>
					<PillBackground className={styles.background} aria-hidden="true" />
					{formatMoney(entry.payoutMinorUnits, minorUnitExponent, entry.currency)}
				</li>
			))}
		</ul>
	);
}

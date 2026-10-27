import { FitText } from "@/components/FitText";
import type { GameConfig } from "@/types/api";
import { formatMoney } from "@/utils/formatMoney";

import styles from "./BalanceSection.module.css";

export type BalanceSectionProps = {
	balanceMinorUnits: number;
	currency: string;
	config: Pick<GameConfig, "minorUnitExponent">;
};

/** The player's balance. Shown in the bottom bar, and in the top bar on a landscape phone. */
export function BalanceSection({ balanceMinorUnits, currency, config }: BalanceSectionProps) {
	return (
		<div className={styles.balance}>
			<dl className={styles.group}>
				<dt className={styles.label}>Balance</dt>
				<dd className={styles.value}>
					<FitText>{formatMoney(balanceMinorUnits, config.minorUnitExponent, currency)}</FitText>
				</dd>
			</dl>
		</div>
	);
}

import { useEffect, useMemo } from "react";

import { BetInput } from "@/components/BetInput";
import { FitText } from "@/components/FitText";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GameConfig } from "@/types/api";
import { formatMoney } from "@/utils/formatMoney";

import styles from "./BetSection.module.css";

/** The part of the session config the bet control needs. */
export type BetConfig = Pick<
	GameConfig,
	"minorUnitExponent" | "minWagerMinorUnits" | "maxWagerMinorUnits" | "wagerStepsMinorUnits"
>;

export type BetSectionProps = {
	betMinorUnits: number;
	currency: string;
	config: BetConfig;
	/** Locks the control while a round is in flight. */
	busy: boolean;
	onBetChange: (betMinorUnits: number) => void;
};

/**
 * The wager control: a stepper over `config.wagerStepsMinorUnits` plus a quick-select popup. The bet stays inside
 * `config.minWagerMinorUnits` to `config.maxWagerMinorUnits`: a value outside is shown, and reported to the parent
 * through `onBetChange`, as the nearest limit.
 */
export function BetSection({ betMinorUnits, currency, config, busy, onBetChange }: BetSectionProps) {
	const compact = useIsMobile();
	const { minorUnitExponent, minWagerMinorUnits: min, maxWagerMinorUnits: max, wagerStepsMinorUnits } = config;

	const bet = Math.min(max, Math.max(min, betMinorUnits));
	const steps = useMemo(
		() => wagerStepsMinorUnits.filter(step => step >= min && step <= max),
		[wagerStepsMinorUnits, min, max]
	);

	useEffect(() => {
		if (bet !== betMinorUnits) onBetChange(bet);
	}, [bet, betMinorUnits, onBetChange]);

	return (
		<div className={styles.bet}>
			<BetInput
				orientation={compact ? "horizontal" : "vertical"}
				label="Bet"
				value={bet}
				increments={steps}
				format={amount => (
					<FitText align={compact ? "center" : "start"} className={styles.amount}>
						{formatMoney(amount, minorUnitExponent, currency)}
					</FitText>
				)}
				disabled={busy}
				onValueChange={next => onBetChange(Math.min(max, Math.max(min, next)))}
			/>
		</div>
	);
}

import { BalanceSection } from "./BalanceSection";
import { type BetConfig, BetSection } from "./BetSection";
import styles from "./BottomBar.module.css";
import { CallToActionSection, type CallToActionState } from "./CallToActionSection";
import { MenuAudioSection } from "./MenuAudioSection";

export type BottomBarProps = {
	balanceMinorUnits: number;
	currency: string;
	config: BetConfig;
	betMinorUnits: number;
	onBetChange: (betMinorUnits: number) => void;
	ctaState: CallToActionState;
	/** Left out until a round can be started; the button is then inert. */
	onCtaClick?: () => void;
};

/**
 * The controls over the canvas: menu and audio, balance, bet and the call to action. One layout per size, all CSS:
 * a full-width column on a portrait phone, a compact row on a landscape phone (the balance moves to the TopBar), a
 * floating centred bar from tablet landscape up. Props only: the parent owns the money, the bet and the round.
 */
export function BottomBar({
	balanceMinorUnits,
	currency,
	config,
	betMinorUnits,
	onBetChange,
	ctaState,
	onCtaClick
}: BottomBarProps) {
	return (
		<div className={styles.container}>
			<div className={styles.bar}>
				<div className={styles.menuBalance}>
					<MenuAudioSection />
					<div className={styles.balanceSlot}>
						<BalanceSection balanceMinorUnits={balanceMinorUnits} currency={currency} config={config} />
					</div>
				</div>
				<BetSection
					betMinorUnits={betMinorUnits}
					currency={currency}
					config={config}
					busy={ctaState === "busy"}
					onBetChange={onBetChange}
				/>
				<CallToActionSection state={ctaState} onClick={onCtaClick} />
			</div>
		</div>
	);
}

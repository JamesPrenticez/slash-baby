import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

import styles from "./GameInfoModal.module.css";

export type GameInfoModalProps = {
	open: boolean;
	onClose: () => void;
};

/**
 * NGU's game info modal. ALL COPY BELOW IS PLACEHOLDER: it describes the intended flow in general terms and states
 * no odds, multipliers or limits. Replace it with approved text before release. NGU's volatility, feature buy, RNG and RTP,
 * auto play, turbo and max win sections are left out because Slash Baby has no such features (docs/TEAM.md, override 3).
 */
export function GameInfoModal({ open, onClose }: GameInfoModalProps) {
	return (
		<Modal open={open} title="GAME INFO" onClose={onClose} className={styles.panel}>
			<div className={styles.content}>
				<section aria-label="How to play">
					<p>
						Place your bet and press PLAY to send the assassin on a run. Along the way the run may ask you to make a
						choice, such as picking a weapon upgrade.
					</p>
					<p>
						When the run ends, the result is paid out and added to your balance. Every result is decided by the game
						server.
					</p>
				</section>

				<section aria-label="Round controls">
					<h3>Round controls</h3>
					<p>
						Before a round has started, the PLAY button is shown. Pressing it takes your bet from your balance and
						begins the run.
					</p>
					<div className={styles.preview} aria-hidden="true">
						<Button className={styles.previewButton} tabIndex={-1}>
							PLAY
						</Button>
					</div>
				</section>

				<section aria-label="History">
					<h3>History</h3>
					<p>
						The result of any completed round can be viewed in History, from the menu. Rounds that are still running are
						not listed.
					</p>
				</section>

				<section aria-label="Balance">
					<h3>Balance</h3>
					<p>
						Your current balance is shown in the Balance display. Your bets and winnings are shown in the same currency.
					</p>
				</section>

				<section aria-label="Bet">
					<h3>Bet</h3>
					<p>
						Use the bet controls to change your bet before a round starts. The smallest and largest bets are set by the
						game.
					</p>
				</section>
			</div>

			<footer className={styles.footer}>
				<a href="https://animo.net/" target="_blank" rel="noopener noreferrer">
					Animo.Net
				</a>
			</footer>
		</Modal>
	);
}

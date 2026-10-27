import { Button } from "@/components/Button";

import styles from "./UserInterface.module.css";

export type RoundErrorBannerProps = {
	message: string;
	/** Left out for a definite refusal, which has nothing to retry. */
	onRetry?: () => void;
};

/** The server's words for a failed bet or settle. Retry resends the same request with the same key. */
export function RoundErrorBanner({ message, onRetry }: RoundErrorBannerProps) {
	return (
		<div className={styles.banner}>
			<p role="alert" className={styles.message}>
				{message}
			</p>
			{onRetry && (
				<Button variant="secondary" className={styles.retry} onClick={onRetry}>
					Retry
				</Button>
			)}
		</div>
	);
}

import { Button } from "@/components/Button";

import styles from "./ErrorScreen.module.css";

export type ErrorScreenProps = {
	message: string;
	onRetry: () => void;
};

/** Full-screen error with a Retry. The message is announced as an alert. */
export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
	return (
		<div className={styles.screen}>
			<div className={styles.panel}>
				<div role="alert" className={styles.text}>
					<h1 className={styles.title}>Something went wrong</h1>
					<p className={styles.message}>{message}</p>
				</div>
				<Button className={styles.retry} onClick={onRetry}>
					Retry
				</Button>
			</div>
		</div>
	);
}

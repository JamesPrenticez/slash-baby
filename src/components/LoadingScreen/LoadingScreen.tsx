import styles from "./LoadingScreen.module.css";

export type LoadingScreenProps = {
	/** Asset load progress from 0 to 1 (Pixi's `onProgress` scale). Omit it for an indeterminate bar. */
	progress?: number;
};

/** Full-screen loading overlay: the title, a progress bar and the percentage. It covers everything until unmounted. */
export function LoadingScreen({ progress }: LoadingScreenProps) {
	const percent = progress === undefined ? undefined : Math.min(100, Math.max(0, Math.round(progress * 100)));

	return (
		<div className={styles.screen}>
			<p className={styles.title}>Slash Baby</p>
			<div
				role="progressbar"
				aria-label="Loading"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={percent}
				data-indeterminate={percent === undefined ? "" : undefined}
				className={styles.bar}
			>
				<div className={styles.fill} style={percent === undefined ? undefined : { width: `${percent}%` }} />
			</div>
			{percent !== undefined && <p className={styles.percent}>{percent}%</p>}
		</div>
	);
}

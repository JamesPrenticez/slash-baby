import { BalanceSection, type BalanceSectionProps } from "@/components/BottomBar";

import styles from "./TopBar.module.css";

export type TopBarProps = BalanceSectionProps;

/**
 * The balance at the top left of a landscape phone, where the bottom bar is too short to hold it. Hidden in
 * portrait and from tablet up (the BottomBar carries the balance there), so it is safe to mount at all sizes.
 */
export function TopBar(props: TopBarProps) {
	return (
		<div className={styles.topBar}>
			<BalanceSection {...props} />
		</div>
	);
}

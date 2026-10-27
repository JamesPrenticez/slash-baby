import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import type { HistoryEntry } from "@/types/round";
import { formatMoney } from "@/utils/formatMoney";

import styles from "./BetHistoryModal.module.css";

/** Rounds per page. The parent sends this as `limit` and the offset it is given by `onPage` as `offset`. */
export const HISTORY_PAGE_SIZE = 10;

export type BetHistoryModalProps = {
	open: boolean;
	onClose: () => void;
	/** Settled rounds, newest first, everything loaded so far. */
	entries: HistoryEntry[];
	/** How many settled rounds the server holds. */
	total: number;
	/** True while a page is on its way. */
	loading: boolean;
	/** Decimal places of the currency (`GameConfig.minorUnitExponent`), for `formatMoney`. */
	exponent: number;
	currency: string;
	/**
	 * Asks for a page of `HISTORY_PAGE_SIZE` rounds starting at `offset`. Called with 0 each time the modal opens
	 * (replace the list) and with `entries.length` for LOAD MORE (append to it).
	 */
	onPage: (offset: number) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/mm/yyyy, HH:MM:SS in local time, spelled out so it does not drift with the viewer's locale. */
function formatDateTime(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
	return `${day}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

type HistoryRowProps = { entry: HistoryEntry; exponent: number; currency: string };

function HistoryRow({ entry, exponent, currency }: HistoryRowProps) {
	const [open, setOpen] = useState(false);
	const detailsId = useId();
	const won = entry.category !== "loss";
	const money = (minor: number) => formatMoney(minor, exponent, currency);

	return (
		<li className={styles.row}>
			<button
				type="button"
				className={styles.summary}
				aria-expanded={open}
				aria-controls={open ? detailsId : undefined}
				onClick={() => setOpen(value => !value)}
			>
				<span className={styles.cell}>{money(entry.wagerMinorUnits)}</span>{" "}
				<span className={styles.cell}>
					<span className={styles.badge} data-loss={won ? undefined : ""}>
						{entry.category.replace("_", " ")}
					</span>
				</span>{" "}
				<span className={`${styles.cell} ${styles.result}`} data-win={won ? "" : undefined}>
					{won ? `+${money(entry.payoutMinorUnits)}` : `-${money(entry.wagerMinorUnits)}`}
				</span>
			</button>
			{open && (
				<dl id={detailsId} className={styles.details}>
					<div className={styles.group}>
						<dt>Round ID</dt>
						<dd>{entry.roundId}</dd>
					</div>
					<div className={styles.group}>
						<dt>Played</dt>
						<dd>{formatDateTime(entry.createdAt)}</dd>
					</div>
					<div className={styles.group}>
						<dt>Settled</dt>
						<dd>{formatDateTime(entry.settledAt)}</dd>
					</div>
				</dl>
			)}
		</li>
	);
}

/**
 * NGU's bet history: a list of settled rounds, each opening to its id and times, with LOAD MORE. NGU's
 * multiplier, mode, difficulty and fairness columns are left out. The outcome column shows the server's category,
 * because the client never works out a multiplier. Money comes from integer minor units through `formatMoney`.
 */
export function BetHistoryModal({
	open,
	onClose,
	entries,
	total,
	loading,
	exponent,
	currency,
	onPage
}: BetHistoryModalProps) {
	const onPageRef = useRef(onPage);
	useEffect(() => {
		onPageRef.current = onPage;
	});

	useEffect(() => {
		if (open) onPageRef.current(0);
	}, [open]);

	return (
		<Modal open={open} title="BET HISTORY" onClose={onClose}>
			<div className={styles.body}>
				{entries.length === 0 ? (
					<p className={styles.empty} role={loading ? "status" : undefined}>
						{loading ? "Loading..." : "No rounds yet."}
					</p>
				) : (
					<>
						<div className={styles.head} aria-hidden="true">
							<span>BET</span>
							<span>OUTCOME</span>
							<span>RESULT</span>
						</div>
						<ul className={styles.list}>
							{entries.map(entry => (
								<HistoryRow key={entry.roundId} entry={entry} exponent={exponent} currency={currency} />
							))}
						</ul>
					</>
				)}
			</div>

			{entries.length < total && (
				<footer className={styles.footer}>
					<Button variant="outline" className={styles.more} disabled={loading} onClick={() => onPage(entries.length)}>
						{loading ? "LOADING..." : "LOAD MORE"}
					</Button>
				</footer>
			)}
		</Modal>
	);
}

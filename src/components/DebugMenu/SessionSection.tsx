import { useEffect, useId, useState } from "react";

import {
	creditBalance,
	expireSession,
	getDebugPlayerId,
	getDebugState,
	resetPlayer,
	setBalance,
	switchCurrency
} from "@/api/debug";
import { getBalance } from "@/api/roundClient";
import { useWalletStore } from "@/stores/walletStore";
import type { DebugState } from "@/types/debug";

import styles from "./DebugMenu.module.css";

type Currency = DebugState["currencies"][number];

/** Shown until the server's list arrives, and kept if it never does. */
const FALLBACK_CURRENCIES: Currency[] = [{ code: "USD", minorUnitExponent: 2 }];

/** A whole number of minor units, or `undefined` when the field is empty or not one. */
const minorUnitsOf = (text: string) => (/^\d+$/.test(text) ? Number(text) : undefined);

/**
 * Session and wallet controls (debug routes only): set and credit the balance, switch the currency, expire the session,
 * reset the player, and read back the contract version, player and session. Every amount is entered and shown in
 * integer minor units; what the server answers replaces the wallet.
 */
export function SessionSection() {
	const { config, playerId, currency, balanceMinorUnits } = useWalletStore();
	const setWalletBalance = useWalletStore(state => state.setBalance);
	const setSession = useWalletStore(state => state.setSession);

	const [currencies, setCurrencies] = useState(FALLBACK_CURRENCIES);
	const [target, setTarget] = useState("");
	const [credit, setCredit] = useState("");
	const [wanted, setWanted] = useState(currency);
	const [note, setNote] = useState("");
	const balanceId = useId();
	const creditId = useId();
	const currencyId = useId();

	useEffect(() => {
		let live = true;
		getDebugState()
			.then(state => live && setCurrencies(state.currencies))
			.catch(() => {
				// The fallback list stays.
			});
		return () => {
			live = false;
		};
	}, []);

	/** Runs one debug call. A refusal is shown, not thrown: the wallet keeps what the server last said. */
	const act = (label: string, call: () => Promise<void>) => async () => {
		setNote(`${label}...`);
		try {
			await call();
			setNote(`${label}: ok`);
		} catch (error) {
			const code = error instanceof Error && "code" in error ? String(error.code) : "error";
			setNote(`${label}: ${code}`);
		}
	};

	const targetMinorUnits = minorUnitsOf(target);

	return (
		<fieldset className={styles.group}>
			<legend className={styles.legend}>Session and wallet</legend>
			<dl className={styles.readouts}>
				<div className={styles.readout}>
					<dt>server</dt>
					<dd>
						<span className={styles.badge}>MOCK</span>
					</dd>
				</div>
				<div className={styles.readout}>
					<dt>contract</dt>
					<dd>{config?.contractVersion}</dd>
				</div>
				<div className={styles.readout}>
					<dt>player</dt>
					<dd>{playerId}</dd>
				</div>
				<div className={styles.readout}>
					<dt>tester id</dt>
					<dd>{getDebugPlayerId()}</dd>
				</div>
				<div className={styles.readout}>
					<dt>balance</dt>
					<dd>{`${balanceMinorUnits} (${currency}, exp ${config?.minorUnitExponent})`}</dd>
				</div>
			</dl>

			<div className={styles.field}>
				<label htmlFor={balanceId}>Balance (minor units)</label>
				<input
					id={balanceId}
					type="number"
					min={0}
					className={styles.select}
					value={target}
					onChange={event => setTarget(event.target.value)}
				/>
			</div>
			<button
				type="button"
				className={styles.action}
				disabled={targetMinorUnits === undefined}
				onClick={act("Set balance", async () => {
					setWalletBalance((await setBalance(targetMinorUnits ?? 0)).balanceMinorUnits);
				})}
			>
				Set balance
			</button>

			<div className={styles.field}>
				<label htmlFor={creditId}>Credit (minor units)</label>
				<input
					id={creditId}
					type="number"
					min={0}
					placeholder="default"
					className={styles.select}
					value={credit}
					onChange={event => setCredit(event.target.value)}
				/>
			</div>
			<button
				type="button"
				className={styles.action}
				onClick={act("Credit", async () => {
					setWalletBalance((await creditBalance(minorUnitsOf(credit))).balanceMinorUnits);
				})}
			>
				Credit
			</button>

			<div className={styles.field}>
				<label htmlFor={currencyId}>Currency</label>
				<select
					id={currencyId}
					className={styles.select}
					value={wanted}
					onChange={event => setWanted(event.target.value)}
				>
					{currencies.map(({ code, minorUnitExponent }) => (
						<option key={code} value={code}>
							{`${code} (${minorUnitExponent})`}
						</option>
					))}
				</select>
			</div>
			<button
				type="button"
				className={styles.action}
				onClick={act("Switch currency", async () => setSession(await switchCurrency(wanted)))}
			>
				Switch currency
			</button>

			<button
				type="button"
				className={styles.action}
				onClick={act("Expire session", () => expireSession().then(() => {}))}
			>
				Expire session
			</button>
			<button
				type="button"
				className={styles.action}
				onClick={act("Reset player", async () => {
					await resetPlayer();
					setWalletBalance((await getBalance()).balanceMinorUnits);
				})}
			>
				Reset player
			</button>

			<p role="status" className={styles.note}>
				{note}
			</p>
		</fieldset>
	);
}

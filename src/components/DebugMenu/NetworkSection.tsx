import { useEffect, useId, useState } from "react";

import { getDebugState, setSimulation } from "@/api/debug";
import type { DebugSimulation } from "@/types/debug";

import styles from "./DebugMenu.module.css";
import { describeFailure } from "./describeFailure";

type Verb = NonNullable<NonNullable<DebugSimulation["failNext"]>["verb"]>;

/** A whole number from a text field, or `undefined` when it is empty or not one. */
const wholeOf = (text: string) => (/^\d+$/.test(text) ? Number(text) : undefined);

type FieldProps = { id: string; label: string; value: string; placeholder?: string; onChange: (value: string) => void };

function NumberField({ id, label, value, placeholder, onChange }: FieldProps) {
	return (
		<div className={styles.field}>
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				type="number"
				min={0}
				className={styles.select}
				placeholder={placeholder}
				value={value}
				onChange={event => onChange(event.target.value)}
			/>
		</div>
	);
}

/**
 * Transport faults for testing the client (debug routes only): latency, a rate of simulated 500s, failing the next N
 * requests, dropping the connection after the server accepted a bet, and a delayed resolution. They apply to the
 * player's own game requests and never change what a round pays.
 */
export function NetworkSection() {
	const [simulation, setCurrent] = useState<DebugSimulation | null>(null);
	const [latency, setLatency] = useState("");
	const [errorRate, setErrorRate] = useState("");
	const [drop, setDrop] = useState("");
	const [resolveDelay, setResolveDelay] = useState("");
	const [failCount, setFailCount] = useState("1");
	const [failStatus, setFailStatus] = useState("500");
	const [failVerb, setFailVerb] = useState<"" | Verb>("");
	const [note, setNote] = useState("");
	const ids = {
		latency: useId(),
		rate: useId(),
		drop: useId(),
		delay: useId(),
		count: useId(),
		status: useId(),
		verb: useId()
	};

	useEffect(() => {
		let live = true;
		getDebugState()
			.then(state => live && setCurrent(state.simulation))
			.catch(() => {
				// The readout stays empty.
			});
		return () => {
			live = false;
		};
	}, []);

	const send = (label: string, patch: Partial<DebugSimulation>) => async () => {
		setNote(`${label}...`);
		try {
			setCurrent((await setSimulation(patch)).simulation);
			setNote(`${label}: ok`);
		} catch (error) {
			setNote(`${label}: ${describeFailure(error)}`);
		}
	};

	const rate = errorRate === "" ? undefined : Number(errorRate);
	const patch: Partial<DebugSimulation> = {
		...(wholeOf(latency) !== undefined && { latencyMs: wholeOf(latency) }),
		...(rate !== undefined && Number.isFinite(rate) && { errorRate: rate }),
		...(wholeOf(drop) !== undefined && { dropAfterAccept: wholeOf(drop) }),
		...(wholeOf(resolveDelay) !== undefined && { resolveDelayMs: wholeOf(resolveDelay) })
	};
	const failNext: DebugSimulation["failNext"] = {
		count: wholeOf(failCount) ?? 1,
		status: wholeOf(failStatus) ?? 500,
		...(failVerb && { verb: failVerb })
	};

	return (
		<fieldset className={styles.group}>
			<legend className={styles.legend}>Network</legend>

			<NumberField
				id={ids.latency}
				label="Latency (ms)"
				value={latency}
				placeholder={String(simulation?.latencyMs ?? "")}
				onChange={setLatency}
			/>
			<NumberField
				id={ids.rate}
				label="Error rate (0 to 1)"
				value={errorRate}
				placeholder={String(simulation?.errorRate ?? "")}
				onChange={setErrorRate}
			/>
			<NumberField
				id={ids.drop}
				label="Drop after accept (requests)"
				value={drop}
				placeholder={String(simulation?.dropAfterAccept ?? "")}
				onChange={setDrop}
			/>
			<NumberField
				id={ids.delay}
				label="Resolve delay (ms)"
				value={resolveDelay}
				placeholder={String(simulation?.resolveDelayMs ?? "")}
				onChange={setResolveDelay}
			/>
			<button
				type="button"
				className={styles.action}
				disabled={Object.keys(patch).length === 0}
				onClick={send("Apply", patch)}
			>
				Apply
			</button>

			<NumberField id={ids.count} label="Fail next (requests)" value={failCount} onChange={setFailCount} />
			<NumberField id={ids.status} label="Fail status" value={failStatus} onChange={setFailStatus} />
			<div className={styles.field}>
				<label htmlFor={ids.verb}>Fail verb</label>
				<select
					id={ids.verb}
					className={styles.select}
					value={failVerb}
					onChange={event => setFailVerb(event.target.value as "" | Verb)}
				>
					<option value="">any request</option>
					<option value="start">start</option>
					<option value="decide">decide</option>
					<option value="settle">settle</option>
				</select>
			</div>
			<div className={styles.buttons}>
				<button type="button" className={styles.action} onClick={send("Fail next", { failNext })}>
					Fail next
				</button>
				<button
					type="button"
					className={styles.action}
					onClick={send("Clear all", {
						latencyMs: 0,
						errorRate: 0,
						failNext: null,
						dropAfterAccept: 0,
						resolveDelayMs: 0
					})}
				>
					Clear all
				</button>
			</div>

			<p aria-live="polite" className={styles.note}>
				{note}
			</p>

			<dl className={styles.readouts}>
				<div className={styles.readout}>
					<dt>simulation</dt>
					<dd data-testid="network-simulation">{simulation ? JSON.stringify(simulation) : "—"}</dd>
				</div>
			</dl>
		</fieldset>
	);
}

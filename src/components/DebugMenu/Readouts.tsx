import { useEffect, useRef } from "react";
import { Ticker } from "pixi.js";

import { probe } from "@/utils/debugProbe";

import styles from "./DebugMenu.module.css";
import { type ReadoutKey, READOUTS, readoutValues } from "./readoutValues";

/** About 4 Hz: often enough to watch, rare enough to cost nothing. */
const REFRESH_MS = 250;

/** The probe's values, written straight into the DOM on a timer. No React state, so no render per refresh. */
export function Readouts() {
	const listRef = useRef<HTMLDListElement>(null);

	useEffect(() => {
		const refresh = () => {
			const values = readoutValues(probe, {
				canvases: document.querySelectorAll("canvas").length,
				sharedTickerListeners: Ticker.shared.count
			});
			listRef.current?.querySelectorAll<HTMLElement>("[data-readout]").forEach(cell => {
				cell.textContent = values[cell.dataset.readout as ReadoutKey];
			});
		};
		refresh();
		const id = setInterval(refresh, REFRESH_MS);
		return () => clearInterval(id);
	}, []);

	return (
		<dl ref={listRef} className={styles.readouts}>
			{READOUTS.map(({ key, label }) => (
				<div key={key} className={styles.readout}>
					<dt>{label}</dt>
					<dd data-readout={key} />
				</div>
			))}
		</dl>
	);
}

import { useState } from "react";

import { PLAN_DEMO, SINGLE_EVENTS, singleEventPlan } from "@/constants/presentationMaps";
import { type LogEntry, usePresentationStore } from "@/stores/presentationStore";
import { probe } from "@/utils/debugProbe";

import styles from "./DebugMenu.module.css";

const PLAYBACK_SPEEDS = [0.5, 1, 2, 4];
/** One single-step, in plan time. */
const STEP_MS = 100;
const LOG_LINES = 8;

const describeEntry = (entry: LogEntry) => `${entry.seq} ${entry.kind} ${entry.index} ${entry.event.type}`;

/**
 * Presentation controls: play the demo plan, pause, step, skip, restart, cancel, playback speed, fire a single event, and
 * force an asset failure; plus the active event, plan position and log. All of it talks to the presentation store and
 * never to a round, so none of it can change money.
 */
export function PresentationSection() {
	const store = usePresentationStore();
	const [failAssets, setFailAssets] = useState(probe.failAssets);
	const total = store.plan?.events.length ?? 0;

	const toggleFail = () => {
		probe.failAssets = !failAssets;
		setFailAssets(!failAssets);
	};

	return (
		<fieldset className={styles.group}>
			<legend className={styles.legend}>Presentation</legend>

			<div className={styles.buttons}>
				<button type="button" className={styles.action} onClick={() => store.play(PLAN_DEMO)}>
					Play demo plan
				</button>
				<button
					type="button"
					className={styles.action}
					aria-pressed={store.paused}
					onClick={store.paused ? store.resume : store.pause}
				>
					{store.paused ? "Resume" : "Pause"}
				</button>
				<button type="button" className={styles.action} onClick={() => store.step(STEP_MS)}>
					Step
				</button>
				<button type="button" className={styles.action} onClick={store.skipEvent}>
					Skip event
				</button>
				<button type="button" className={styles.action} onClick={store.restart}>
					Restart
				</button>
				<button type="button" className={styles.action} onClick={store.cancel}>
					Cancel
				</button>
			</div>

			<fieldset className={styles.group}>
				<legend className={styles.legend}>Playback speed</legend>
				<div className={styles.buttons}>
					{PLAYBACK_SPEEDS.map(speed => (
						<button
							key={speed}
							type="button"
							className={styles.action}
							aria-pressed={store.playbackSpeed === speed}
							onClick={() => store.setSpeed(speed)}
						>
							{`x${speed}`}
						</button>
					))}
				</div>
			</fieldset>

			<fieldset className={styles.group}>
				<legend className={styles.legend}>Fire one event</legend>
				<div className={styles.buttons}>
					{SINGLE_EVENTS.map(event => (
						<button
							key={event.type}
							type="button"
							className={styles.action}
							onClick={() => store.play(singleEventPlan(event))}
						>
							{event.type}
						</button>
					))}
				</div>
			</fieldset>

			<button type="button" className={styles.action} aria-pressed={failAssets} onClick={toggleFail}>
				Fail assets
			</button>

			<dl className={styles.readouts}>
				<div className={styles.readout}>
					<dt>plan</dt>
					<dd data-testid="presentation-plan">{store.plan?.planId ?? "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>status</dt>
					<dd data-testid="presentation-status">{store.status}</dd>
				</div>
				<div className={styles.readout}>
					<dt>active event</dt>
					<dd data-testid="presentation-active">{store.activeEvent?.type ?? "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>position</dt>
					<dd data-testid="presentation-position">{total ? `${store.position}/${total}` : "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>playback speed</dt>
					<dd data-testid="presentation-speed">{`x${store.playbackSpeed}`}</dd>
				</div>
			</dl>
			<ol className={styles.log} aria-label="Presentation log" data-testid="presentation-log">
				{store.log.slice(-LOG_LINES).map(entry => (
					<li key={entry.seq}>{describeEntry(entry)}</li>
				))}
			</ol>
		</fieldset>
	);
}

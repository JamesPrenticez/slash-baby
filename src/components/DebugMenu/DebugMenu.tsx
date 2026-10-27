import { useEffect, useId } from "react";

import { ASSASSIN_ANIMATIONS, type AssassinAnimation } from "@/constants/assassinAnimations";
import { type DebugControls, useDebugStore } from "@/stores/debugStore";

import styles from "./DebugMenu.module.css";
import { NetworkSection } from "./NetworkSection";
import { PresentationSection } from "./PresentationSection";
import { Readouts } from "./Readouts";
import { RoundsSection } from "./RoundsSection";
import { SessionSection } from "./SessionSection";

const SPEEDS = [0.5, 1, 2, 4];

const ANIMATIONS = Object.keys(ASSASSIN_ANIMATIONS) as AssassinAnimation[];

type DebugMenuProps = {
	running: boolean;
	onRunningChange: (running: boolean) => void;
	/** Called with the current controls on mount and again whenever one changes. */
	onControls: (controls: DebugControls) => void;
};

/**
 * The debug menu: a toggle and a panel that floats over the page without blocking it. The app mounts it only when
 * `VITE_DEBUG === "true"`, from a dynamic import. Each phase adds the controls for its own features.
 */
export function DebugMenu(props: DebugMenuProps) {
	if (import.meta.env.VITE_DEBUG !== "true") return null;
	return <Menu {...props} />;
}

function Menu({ running, onRunningChange, onControls }: DebugMenuProps) {
	const panelId = useId();
	const speedId = useId();
	const { open, animation, speedMultiplier, canvasKey, toggleOpen, setAnimation, setSpeedMultiplier, remountCanvas } =
		useDebugStore();

	useEffect(() => {
		onControls({ animation, speedMultiplier, canvasKey });
	}, [animation, speedMultiplier, canvasKey, onControls]);

	return (
		<div className={styles.root}>
			<button
				type="button"
				className={styles.toggle}
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				onClick={toggleOpen}
			>
				Debug
			</button>
			{open && (
				<section id={panelId} className={styles.panel} aria-label="Debug menu">
					<button type="button" className={styles.action} onClick={() => onRunningChange(!running)}>
						{running ? "Stop" : "Run"}
					</button>

					<fieldset className={styles.group}>
						<legend className={styles.legend}>Animation</legend>
						<div className={styles.buttons}>
							<button
								type="button"
								className={styles.action}
								aria-pressed={animation === undefined}
								onClick={() => setAnimation(undefined)}
							>
								auto
							</button>
							{ANIMATIONS.map(name => (
								<button
									key={name}
									type="button"
									className={styles.action}
									aria-pressed={animation === name}
									onClick={() => setAnimation(name)}
								>
									{name}
								</button>
							))}
						</div>
					</fieldset>

					<div className={styles.field}>
						<label htmlFor={speedId}>Speed</label>
						<select
							id={speedId}
							className={styles.select}
							value={speedMultiplier}
							onChange={event => setSpeedMultiplier(Number(event.target.value))}
						>
							{SPEEDS.map(speed => (
								<option key={speed} value={speed}>
									×{speed}
								</option>
							))}
						</select>
					</div>

					<button type="button" className={styles.action} onClick={remountCanvas}>
						Remount canvas
					</button>

					<PresentationSection />

					<SessionSection />

					<RoundsSection />

					<NetworkSection />

					<Readouts />
				</section>
			)}
		</div>
	);
}

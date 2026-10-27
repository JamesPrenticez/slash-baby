import { type CSSProperties, useEffect, useRef } from "react";

import AudioIcon from "@/assets/icons/audio.svg?react";
import HistoryIcon from "@/assets/icons/history.svg?react";
import InfoIcon from "@/assets/icons/info.svg?react";
import MusicIcon from "@/assets/icons/music.svg?react";
import { Slider } from "@/components/Slider";
import { useClickOutside } from "@/hooks/useClickOutside";

import styles from "./MenuModal.module.css";

export type MenuModalProps = {
	open: boolean;
	/** Called by Escape, a press outside, and after a row opens another modal. */
	onClose: () => void;
	/** Both from 0 to 1. */
	effectsVolume: number;
	onEffectsVolumeChange: (volume: number) => void;
	musicVolume: number;
	onMusicVolumeChange: (volume: number) => void;
	/** The menu closes itself right after calling this. */
	onOpenHistory: () => void;
	/** The menu closes itself right after calling this. */
	onOpenGameInfo: () => void;
	/**
	 * Overrides the breakpoint position, for example to pin the popover above its toggle on a tablet in portrait.
	 * The toggle should carry `data-ignore-click-away` so a press on it does not also count as a press outside.
	 */
	style?: CSSProperties;
};

/**
 * NGU's menu: a popover that floats over the bottom bar with the effects and music sliders and a row for each
 * of the history and game info modals. Not modal: the page behind stays usable. NGU's scroll and fairness rows
 * are left out because Slash Baby has no camera to pan and no seeds (docs/TEAM.md, override 3).
 */
export function MenuModal({
	open,
	onClose,
	effectsVolume,
	onEffectsVolumeChange,
	musicVolume,
	onMusicVolumeChange,
	onOpenHistory,
	onOpenGameInfo,
	style
}: MenuModalProps) {
	const ref = useRef<HTMLDivElement>(null);

	useClickOutside(ref, onClose);

	// The popover mounts after the bottom bar, so without this a keyboard user would tab through the whole bar to reach it.
	useEffect(() => {
		if (open) ref.current?.querySelector<HTMLElement>("input, button")?.focus();
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			onClose();
			document.querySelector<HTMLElement>("[data-menu-toggle]")?.focus();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	const openThenClose = (openOther: () => void) => () => {
		openOther();
		onClose();
	};

	return (
		<div ref={ref} role="dialog" aria-label="Menu" className={styles.popover} style={style}>
			<div className={styles.row}>
				<AudioIcon className={styles.icon} aria-hidden="true" />
				<span className={styles.label}>Effects</span>
				<div className={`${styles.control} ${styles.slider}`}>
					<Slider aria-label="Effects volume" value={effectsVolume} onValueChange={onEffectsVolumeChange} />
				</div>
			</div>

			<div className={styles.row}>
				<MusicIcon className={styles.icon} aria-hidden="true" />
				<span className={styles.label}>Music</span>
				<div className={`${styles.control} ${styles.slider}`}>
					<Slider aria-label="Music volume" value={musicVolume} onValueChange={onMusicVolumeChange} />
				</div>
			</div>

			<button type="button" className={`${styles.row} ${styles.action}`} onClick={openThenClose(onOpenHistory)}>
				<HistoryIcon className={styles.icon} aria-hidden="true" />
				<span className={styles.label}>History</span>
			</button>

			<button type="button" className={`${styles.row} ${styles.action}`} onClick={openThenClose(onOpenGameInfo)}>
				<InfoIcon className={styles.icon} aria-hidden="true" />
				<span className={styles.label}>Game info</span>
			</button>
		</div>
	);
}

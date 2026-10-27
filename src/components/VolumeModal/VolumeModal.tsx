import { type CSSProperties, useEffect, useRef } from "react";

import AudioIcon from "@/assets/icons/audio.svg?react";
import { Slider } from "@/components/Slider";
import { useClickOutside } from "@/hooks/useClickOutside";

import styles from "./VolumeModal.module.css";

const AUTO_CLOSE_MS = 3000;

export type VolumeModalProps = {
	open: boolean;
	/** Called by Escape, a press outside, and the 3 second idle timeout. */
	onClose: () => void;
	/** From 0 to 1. */
	volume: number;
	onVolumeChange: (volume: number) => void;
	/**
	 * Overrides the breakpoint position, for example to pin the popover above its toggle on a tablet in portrait.
	 * The toggle should carry `data-ignore-click-away` so a press on it does not also count as a press outside.
	 */
	style?: CSSProperties;
};

/**
 * NGU's master volume popover: one slider that floats over the bottom bar and puts itself away after 3 seconds,
 * unless the pointer, a finger or keyboard focus is on it. Not modal: the page behind stays usable.
 */
export function VolumeModal({ open, onClose, volume, onVolumeChange, style }: VolumeModalProps) {
	const ref = useRef<HTMLDivElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	});

	useClickOutside(ref, onClose);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	const pause = () => clearTimeout(timer.current);
	const resume = () => {
		pause();
		if (ref.current?.contains(document.activeElement)) return;
		timer.current = setTimeout(() => onCloseRef.current(), AUTO_CLOSE_MS);
	};

	// Every change of volume starts the countdown over.
	useEffect(() => {
		if (!open) return;
		resume();
		return pause;
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `resume` only reads refs
	}, [open, volume]);

	if (!open) return null;

	return (
		<div
			ref={ref}
			role="dialog"
			aria-label="Volume"
			className={styles.popover}
			style={style}
			onMouseEnter={pause}
			onMouseLeave={resume}
			onTouchStart={pause}
			onTouchEnd={resume}
			onFocus={pause}
			onBlur={resume}
		>
			<div className={styles.row}>
				<AudioIcon className={styles.icon} aria-hidden="true" />
				<div className={styles.control}>
					<Slider aria-label="Volume" value={volume} onValueChange={onVolumeChange} />
				</div>
			</div>
		</div>
	);
}

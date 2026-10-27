import AudioIcon from "@/assets/icons/audio.svg?react";
import AudioOffIcon from "@/assets/icons/audioOff.svg?react";
import HamburgerIcon from "@/assets/icons/hamburger.svg?react";
import XIcon from "@/assets/icons/x.svg?react";
import { IconButton } from "@/components/IconButton";
import { useBottomBarStore } from "@/stores/bottomBarStore";
import { useSettingsStore } from "@/stores/settingsStore";

import styles from "./MenuAudioSection.module.css";

/** The menu and audio buttons. They read and write the stores directly; the panels they open are mounted elsewhere. */
export function MenuAudioSection() {
	const muted = useSettingsStore(state => state.muted);
	const toggleMute = useSettingsStore(state => state.toggleMute);
	const menuOpen = useBottomBarStore(state => state.menuOpen);
	const volumeOpen = useBottomBarStore(state => state.volumeOpen);
	const toggleMenu = useBottomBarStore(state => state.toggleMenu);
	const setVolumeOpen = useBottomBarStore(state => state.setVolumeOpen);
	const setMenuOpen = useBottomBarStore(state => state.setMenuOpen);

	const menuLabel = menuOpen ? "Close Menu" : "Menu";
	const audioLabel = muted ? "Unmute" : "Mute";

	return (
		<div className={styles.menuAudio}>
			<IconButton
				data-ignore-click-away
				data-menu-toggle
				aria-label={menuLabel}
				aria-haspopup="dialog"
				aria-expanded={menuOpen}
				title={menuLabel}
				onClick={toggleMenu}
			>
				{menuOpen ? <XIcon aria-hidden="true" /> : <HamburgerIcon aria-hidden="true" />}
			</IconButton>
			<IconButton
				data-ignore-click-away
				data-volume-toggle
				aria-label={audioLabel}
				title={audioLabel}
				onClick={() => {
					if (!volumeOpen) {
						setVolumeOpen(true);
						setMenuOpen(false);
					}
					toggleMute();
				}}
			>
				{muted ? <AudioOffIcon aria-hidden="true" /> : <AudioIcon aria-hidden="true" />}
			</IconButton>
		</div>
	);
}

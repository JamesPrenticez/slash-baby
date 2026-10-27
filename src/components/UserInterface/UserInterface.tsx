import { useCallback, useEffect, useRef, useState } from "react";

import { getHistory } from "@/api/roundClient";
import { BetHistoryModal, HISTORY_PAGE_SIZE } from "@/components/BetHistoryModal";
import { BottomBar } from "@/components/BottomBar";
import { GameInfoModal } from "@/components/GameInfoModal";
import { MenuModal } from "@/components/MenuModal";
import { ResultsPanel } from "@/components/ResultsPanel";
import { RoundHistory } from "@/components/RoundHistory";
import { TopBar } from "@/components/TopBar";
import { VolumeModal } from "@/components/VolumeModal";
import { useRound } from "@/hooks/useRound";
import { useBottomBarStore } from "@/stores/bottomBarStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWalletStore } from "@/stores/walletStore";
import type { HistoryEntry } from "@/types/round";

import { RoundErrorBanner } from "./RoundErrorBanner";

type History = { entries: HistoryEntry[]; total: number; loading: boolean };

/**
 * Settled rounds as `GET /api/game/history` returns them. Offset 0 replaces the list, any other offset appends. An
 * answer that arrives after a newer request was sent is dropped. A failed load leaves what is there.
 */
function useHistory() {
	const [history, setHistory] = useState<History>({ entries: [], total: 0, loading: false });
	const latest = useRef(0);

	const load = useCallback((offset: number) => {
		const request = ++latest.current;
		setHistory(state => ({ ...state, loading: true }));
		getHistory(HISTORY_PAGE_SIZE, offset)
			.then(({ rounds, total }) => {
				if (request !== latest.current) return;
				setHistory(state => ({
					entries: offset === 0 ? rounds : [...state.entries, ...rounds],
					total,
					loading: false
				}));
			})
			.catch(() => request === latest.current && setHistory(state => ({ ...state, loading: false })));
	}, []);

	return { ...history, load };
}

/**
 * The betting UI over the canvas, as NGU's `user-interface.tsx` minus the parts Slash Baby has no feature for (TEAM
 * override 3): the strip of recent rounds, top and bottom bars, and the menu, volume, game info and bet history panels.
 * Mount it once a session exists. PLAY runs a round (`useRound`); the bet and PLAY stay locked until the results close.
 */
export function UserInterface() {
	const config = useWalletStore(state => state.config);
	const currency = useWalletStore(state => state.currency);
	const balanceMinorUnits = useWalletStore(state => state.balanceMinorUnits);
	const betMinorUnits = useWalletStore(state => state.betMinorUnits);
	const setBet = useWalletStore(state => state.setBet);

	const volume = useSettingsStore(state => state.volume);
	const setVolume = useSettingsStore(state => state.setVolume);
	// Nothing is audible yet, so music has no stored setting to read.
	const [musicVolume, setMusicVolume] = useState(1);

	const menuOpen = useBottomBarStore(state => state.menuOpen);
	const volumeOpen = useBottomBarStore(state => state.volumeOpen);
	const gameInfoOpen = useBottomBarStore(state => state.gameInfoOpen);
	const betHistoryOpen = useBottomBarStore(state => state.betHistoryOpen);
	const setMenuOpen = useBottomBarStore(state => state.setMenuOpen);
	const setVolumeOpen = useBottomBarStore(state => state.setVolumeOpen);
	const setGameInfoOpen = useBottomBarStore(state => state.setGameInfoOpen);
	const setBetHistoryOpen = useBottomBarStore(state => state.setBetHistoryOpen);

	const history = useHistory();
	const loadHistory = history.load;
	useEffect(() => loadHistory(0), [loadHistory]);

	const round = useRound();
	// A settled round joins the strip and the bet history.
	const hasResults = round.results !== null;
	useEffect(() => {
		if (hasResults) loadHistory(0);
	}, [hasResults, loadHistory]);

	const closeMenu = useCallback(() => setMenuOpen(false), [setMenuOpen]);
	const closeVolume = useCallback(() => setVolumeOpen(false), [setVolumeOpen]);
	const closeGameInfo = useCallback(() => setGameInfoOpen(false), [setGameInfoOpen]);
	const closeBetHistory = useCallback(() => setBetHistoryOpen(false), [setBetHistoryOpen]);

	if (!config) return null;

	return (
		<>
			<RoundHistory entries={history.entries} minorUnitExponent={config.minorUnitExponent} />
			<TopBar balanceMinorUnits={balanceMinorUnits} currency={currency} config={config} />
			<BottomBar
				balanceMinorUnits={balanceMinorUnits}
				currency={currency}
				config={config}
				betMinorUnits={betMinorUnits}
				onBetChange={setBet}
				ctaState={round.busy ? "busy" : "idle"}
				onCtaClick={round.play}
			/>
			{round.error && (
				<RoundErrorBanner message={round.error.message} onRetry={round.error.retryable ? round.retry : undefined} />
			)}
			{round.results && (
				<ResultsPanel
					{...round.results}
					currency={currency}
					minorUnitExponent={config.minorUnitExponent}
					onContinue={round.close}
				/>
			)}

			<MenuModal
				open={menuOpen}
				onClose={closeMenu}
				effectsVolume={volume}
				onEffectsVolumeChange={setVolume}
				musicVolume={musicVolume}
				onMusicVolumeChange={setMusicVolume}
				onOpenHistory={() => setBetHistoryOpen(true)}
				onOpenGameInfo={() => setGameInfoOpen(true)}
			/>
			<VolumeModal open={volumeOpen} onClose={closeVolume} volume={volume} onVolumeChange={setVolume} />
			<GameInfoModal open={gameInfoOpen} onClose={closeGameInfo} />
			<BetHistoryModal
				open={betHistoryOpen}
				onClose={closeBetHistory}
				entries={history.entries}
				total={history.total}
				loading={history.loading}
				exponent={config.minorUnitExponent}
				currency={currency}
				onPage={loadHistory}
			/>
		</>
	);
}

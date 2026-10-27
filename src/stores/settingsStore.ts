import { create } from "zustand";

export const SETTINGS_KEY = "slash-baby:settings";

type Persisted = { muted: boolean; volume: number };

const DEFAULTS: Persisted = { muted: false, volume: 1 };

const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume));

/** Reads the saved settings. Anything missing, malformed or unreadable (private window, blocked storage) is a default. */
export function loadSettings(): Persisted {
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
		if (typeof saved !== "object" || saved === null) return DEFAULTS;
		const { muted, volume } = saved as Record<string, unknown>;
		return {
			muted: typeof muted === "boolean" ? muted : DEFAULTS.muted,
			volume: typeof volume === "number" && Number.isFinite(volume) ? clampVolume(volume) : DEFAULTS.volume
		};
	} catch {
		return DEFAULTS;
	}
}

function save({ muted, volume }: Persisted) {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted, volume }));
	} catch {
		// Storage is a convenience: when it is blocked or full the setting still applies for this visit.
	}
}

type SettingsStore = Persisted & {
	setMuted: (muted: boolean) => void;
	toggleMute: () => void;
	/** From 0 to 1; out-of-range values are clamped. */
	setVolume: (volume: number) => void;
};

/** Player audio settings, persisted in localStorage (decision U-7). Nothing is audible until audio assets arrive. */
export const useSettingsStore = create<SettingsStore>((set, get) => {
	const update = (next: Partial<Persisted>) => {
		set(next);
		save(get());
	};

	return {
		...loadSettings(),
		setMuted: muted => update({ muted }),
		toggleMute: () => update({ muted: !get().muted }),
		setVolume: volume => update({ volume: clampVolume(volume) })
	};
});

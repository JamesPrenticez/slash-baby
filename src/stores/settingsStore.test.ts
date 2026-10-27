import { loadSettings, SETTINGS_KEY, useSettingsStore } from "./settingsStore";

const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");

beforeEach(() => {
	localStorage.clear();
	useSettingsStore.setState({ muted: false, volume: 1 });
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("settingsStore", () => {
	it("defaults to unmuted at full volume", () => {
		expect(loadSettings()).toEqual({ muted: false, volume: 1 });
	});

	it("setMuted and toggleMute change the flag and persist it", () => {
		useSettingsStore.getState().setMuted(true);
		expect(useSettingsStore.getState().muted).toBe(true);
		expect(stored()).toEqual({ muted: true, volume: 1 });
		useSettingsStore.getState().toggleMute();
		expect(useSettingsStore.getState().muted).toBe(false);
		expect(stored()).toEqual({ muted: false, volume: 1 });
	});

	it("setVolume persists and clamps to 0..1", () => {
		useSettingsStore.getState().setVolume(0.4);
		expect(useSettingsStore.getState().volume).toBe(0.4);
		expect(stored()).toEqual({ muted: false, volume: 0.4 });
		useSettingsStore.getState().setVolume(7);
		expect(useSettingsStore.getState().volume).toBe(1);
		useSettingsStore.getState().setVolume(-3);
		expect(useSettingsStore.getState().volume).toBe(0);
	});

	it("loads what was stored", () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: true, volume: 0.25 }));
		expect(loadSettings()).toEqual({ muted: true, volume: 0.25 });
	});

	it.each([
		["not JSON", "{nope"],
		["null", "null"],
		["wrong types", JSON.stringify({ muted: "yes", volume: "loud" })],
		["a non-finite volume", '{"muted":false,"volume":null}']
	])("falls back to the defaults for %s", (_name, raw) => {
		localStorage.setItem(SETTINGS_KEY, raw);
		expect(loadSettings()).toEqual({ muted: false, volume: 1 });
	});

	it("keeps a valid half when the other half is bad", () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: true, volume: "loud" }));
		expect(loadSettings()).toEqual({ muted: true, volume: 1 });
	});

	it("clamps a stored volume that is out of range", () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: false, volume: 9 }));
		expect(loadSettings().volume).toBe(1);
	});

	it("survives storage that throws on read", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		expect(loadSettings()).toEqual({ muted: false, volume: 1 });
	});

	it("survives storage that throws on write, and the state still changes", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("quota");
		});
		expect(() => useSettingsStore.getState().setMuted(true)).not.toThrow();
		expect(useSettingsStore.getState().muted).toBe(true);
	});
});

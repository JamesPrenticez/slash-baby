import { act, renderHook, waitFor } from "@testing-library/react";
import { Assets } from "pixi.js";

import { useAssetLoader } from "./useAssetLoader";

vi.mock("pixi.js", () => ({ Assets: { loader: { loadOptions: {} }, load: vi.fn() } }));

describe("useAssetLoader", () => {
	it("reports ready once the assets load", async () => {
		vi.mocked(Assets.load).mockResolvedValue({});
		const { result } = renderHook(() => useAssetLoader());
		expect(result.current.status).toBe("loading");
		await waitFor(() => expect(result.current.status).toBe("ready"));
	});

	it("reports the error when loading fails", async () => {
		vi.mocked(Assets.load).mockRejectedValue(new Error("network down"));
		const { result } = renderHook(() => useAssetLoader());
		await waitFor(() => expect(result.current).toMatchObject({ status: "error", error: "network down" }));
	});

	it("reports progress while loading", async () => {
		let report: (progress: number) => void = () => {};
		vi.mocked(Assets.load).mockImplementation(((_assets: unknown, onProgress: (progress: number) => void) => {
			report = onProgress;
			return new Promise(() => {});
		}) as never);
		const { result } = renderHook(() => useAssetLoader());
		expect(result.current).toMatchObject({ status: "loading", progress: 0 });
		act(() => report(0.4));
		expect(result.current).toMatchObject({ status: "loading", progress: 0.4 });
	});

	it("loads again on retry", async () => {
		vi.mocked(Assets.load).mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({});
		const { result } = renderHook(() => useAssetLoader());
		await waitFor(() => expect(result.current.status).toBe("error"));

		act(() => result.current.retry());
		expect(result.current.status).toBe("loading");
		await waitFor(() => expect(result.current.status).toBe("ready"));
	});

	it("retries failed loads before giving up", () => {
		expect(Assets.loader.loadOptions).toMatchObject({ strategy: "retry", retryCount: 3 });
	});
});

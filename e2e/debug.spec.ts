import { expect, type Page, test } from "@playwright/test";

import { canvasOf, trackErrors } from "./helpers";
import { RUN_SPEED } from "../src/constants/world";

test.beforeEach(() => test.slow());

const ANIMATIONS = [
	["idle", "idle"],
	["run", "run"],
	["jump", "jump"],
	["hit", "hit"],
	["die", "death"],
	["attack", "shoot"]
] as const;

const readout = (page: Page, key: string) => page.locator(`[data-readout="${key}"]`);
const numberOf = async (page: Page, key: string) => Number(await readout(page, key).textContent());

async function openMenu(page: Page) {
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1, { timeout: 30_000 });
	await page.getByRole("button", { name: "Debug" }).click();
	await expect(page.getByRole("region", { name: "Debug menu" })).toBeVisible();
	await expect(readout(page, "fps")).not.toHaveText("—", { timeout: 30_000 });
}

test("the menu opens and closes without covering the page's own PLAY button", async ({ page }) => {
	await openMenu(page);
	const run = page.getByRole("button", { name: "PLAY", exact: true });
	await expect(run).toBeVisible();
	await expect(async () => {
		const box = (await run.boundingBox())!;
		const top = await run.evaluate(
			(node, [x, y]) => node.contains(document.elementFromPoint(x, y)),
			[box.x + box.width / 2, box.y + box.height / 2]
		);
		expect(top).toBe(true);
	}).toPass();

	const panel = (await page.getByRole("region", { name: "Debug menu" }).boundingBox())!;
	const { width, height } = page.viewportSize()!;
	expect(panel.x).toBeGreaterThanOrEqual(0);
	expect(panel.y).toBeGreaterThanOrEqual(0);
	expect(panel.x + panel.width).toBeLessThanOrEqual(width);
	expect(panel.y + panel.height).toBeLessThanOrEqual(height);

	const toggle = page.getByRole("button", { name: "Debug" });
	await toggle.click();
	await expect(page.getByRole("region", { name: "Debug menu" })).toHaveCount(0);
});

test("running causes no React commits", async ({ page }) => {
	await openMenu(page);
	await page.getByRole("region", { name: "Debug menu" }).getByRole("button", { name: "Run", exact: true }).click();
	await expect.poll(() => numberOf(page, "speed")).toBeGreaterThan(0);
	await expect.poll(() => numberOf(page, "scrollX")).toBeGreaterThan(0);

	const before = await numberOf(page, "commits");
	const scrollBefore = await numberOf(page, "scrollX");
	await page.waitForTimeout(2000);

	expect(await numberOf(page, "scrollX")).not.toBe(scrollBefore);
	expect(await numberOf(page, "commits")).toBe(before);
});

test("Remount canvas leaves one canvas and the same ticker listener count", async ({ page }) => {
	await openMenu(page);
	await expect(readout(page, "canvases")).toHaveText("1");
	const listeners = await numberOf(page, "tickerListeners");
	const sharedListeners = await numberOf(page, "sharedTickerListeners");

	for (let i = 0; i < 3; i++) {
		await page.getByRole("button", { name: "Remount canvas" }).click();
		await expect(canvasOf(page)).toHaveCount(1, { timeout: 30_000 });
		await expect(readout(page, "tickerListeners")).toHaveText(String(listeners), { timeout: 15_000 });
	}
	await expect(readout(page, "canvases")).toHaveText("1");
	await expect.poll(() => numberOf(page, "fps"), { timeout: 15_000 }).toBeGreaterThan(0);
	// The readout can sample between the old Spine's removal and the new one's registration; it must settle.
	await expect.poll(() => numberOf(page, "sharedTickerListeners"), { timeout: 15_000 }).toBe(sharedListeners);
});

test("all six animations play without errors", async ({ page }) => {
	const errors = trackErrors(page);
	await openMenu(page);
	const panel = page.getByRole("region", { name: "Debug menu" });

	for (const [logical, spine] of ANIMATIONS) {
		await panel.getByRole("button", { name: logical, exact: true }).click();
		await expect(readout(page, "animation")).toHaveText(spine, { timeout: 15_000 });
	}
	expect(errors).toEqual([]);
});

test("the speed multiplier scales the scroll", async ({ page }) => {
	await openMenu(page);
	await page.getByRole("combobox", { name: "Speed" }).selectOption("4");
	await page.getByRole("region", { name: "Debug menu" }).getByRole("button", { name: "Run", exact: true }).click();
	await expect.poll(() => numberOf(page, "speed")).toBeGreaterThan(RUN_SPEED * 3);
});

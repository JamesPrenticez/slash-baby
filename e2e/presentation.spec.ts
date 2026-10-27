import { expect, type Page, test } from "@playwright/test";

import { canvasOf, trackErrors } from "./helpers";

test.beforeEach(() => test.slow());

const readout = (page: Page, key: string) => page.locator(`[data-readout="${key}"]`);
const numberOf = async (page: Page, key: string) => Number(await readout(page, key).textContent());
const active = (page: Page) => page.getByTestId("presentation-active");
const status = (page: Page) => page.getByTestId("presentation-status");
const press = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).click();

async function openMenu(page: Page) {
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1, { timeout: 30_000 });
	await page.getByRole("button", { name: "Debug" }).click();
	await expect(page.getByRole("region", { name: "Debug menu" })).toBeVisible();
	await expect(readout(page, "fps")).not.toHaveText("—", { timeout: 30_000 });
}

/** The event types of the log's `start` lines, oldest first. */
const startedEvents = async (page: Page) => {
	const lines = await page.getByTestId("presentation-log").getByRole("listitem").allTextContents();
	return lines.filter(line => line.includes(" start ")).map(line => line.split(" ").pop());
};

test("the demo plan plays its three events in order and finishes", async ({ page }) => {
	const errors = trackErrors(page);
	await openMenu(page);
	await expect(status(page)).toHaveText("idle");

	await press(page, "Play demo plan");
	await expect(active(page)).toHaveText("run_intro");
	await expect(page.getByTestId("presentation-position")).toHaveText("0/3");
	await expect(active(page)).toHaveText("coin_trail", { timeout: 45_000 });
	await expect(active(page)).toHaveText("monster_wave", { timeout: 45_000 });
	await expect(status(page)).toHaveText("finished", { timeout: 45_000 });
	await expect(active(page)).toHaveText("—");

	expect(await startedEvents(page)).toEqual(["run_intro", "coin_trail", "monster_wave"]);
	expect(errors).toEqual([]);
});

test("each event draws, then leaves no objects or ticker callbacks behind", async ({ page }) => {
	await openMenu(page);
	const listeners = await numberOf(page, "tickerListeners");

	await press(page, "Pause");
	await press(page, "Play demo plan");
	await press(page, "Skip event");
	await expect(active(page)).toHaveText("coin_trail");
	await expect.poll(() => numberOf(page, "presentationObjects")).toBeGreaterThan(1);
	await expect.poll(() => numberOf(page, "tickerListeners")).toBeGreaterThan(listeners);

	await press(page, "Skip event");
	await expect(active(page)).toHaveText("monster_wave");
	await expect.poll(() => numberOf(page, "presentationObjects")).toBeGreaterThan(1);

	await press(page, "Cancel");
	await expect(status(page)).toHaveText("cancelled");
	await expect.poll(() => numberOf(page, "presentationObjects")).toBe(0);
	await expect.poll(() => numberOf(page, "tickerListeners")).toBe(listeners);
});

test("restarting mid-event starts clean from the first event", async ({ page }) => {
	await openMenu(page);
	const listeners = await numberOf(page, "tickerListeners");

	await press(page, "Pause");
	await press(page, "Play demo plan");
	await press(page, "Skip event");
	await press(page, "Skip event");
	await expect(active(page)).toHaveText("monster_wave");
	await expect.poll(() => numberOf(page, "presentationObjects")).toBeGreaterThan(1);

	await press(page, "Restart");
	await expect(active(page)).toHaveText("run_intro");
	await expect(page.getByTestId("presentation-position")).toHaveText("0/3");
	await expect.poll(() => numberOf(page, "presentationObjects")).toBe(0);
	expect(await startedEvents(page)).toEqual(["run_intro"]);

	await press(page, "Cancel");
	await expect.poll(() => numberOf(page, "tickerListeners")).toBe(listeners);
});

test("run_intro eases the world up and releases it when the event ends", async ({ page }) => {
	await openMenu(page);
	await expect.poll(() => numberOf(page, "speed")).toBe(0);

	await press(page, "run_intro");
	await expect(active(page)).toHaveText("run_intro");
	await expect.poll(() => numberOf(page, "speed")).toBeGreaterThan(0);
	await expect(status(page)).toHaveText("finished", { timeout: 45_000 });
	await expect.poll(() => numberOf(page, "speed"), { timeout: 45_000 }).toBe(0);
});

test("monster_wave has the assassin attack", async ({ page }) => {
	await openMenu(page);
	await press(page, "monster_wave");
	await expect(readout(page, "animation")).toHaveText("shoot", { timeout: 45_000 });
	await expect(status(page)).toHaveText("finished", { timeout: 45_000 });
	await expect.poll(() => numberOf(page, "presentationObjects")).toBe(0);
});

test("outcome_reveal shows the overlay inside the viewport, then clears it", async ({ page }) => {
	await openMenu(page);
	await press(page, "Pause");
	await press(page, "outcome_reveal");
	await expect(active(page)).toHaveText("outcome_reveal");

	const overlay = page.getByTestId("presentation-overlay");
	await expect(overlay).toBeVisible();
	await expect(overlay).toContainText("Outcome reveal");
	const box = (await overlay.boundingBox())!;
	const { width, height } = page.viewportSize()!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
	await page.screenshot({ path: test.info().outputPath("overlay.png") });

	await press(page, "Resume");
	await expect(overlay).toHaveCount(0, { timeout: 45_000 });
	await expect(status(page)).toHaveText("finished");
});

test("a forced asset failure draws nothing and the sequence still finishes", async ({ page }) => {
	await openMenu(page);
	await press(page, "Fail assets");
	await expect(page.getByRole("button", { name: "Fail assets" })).toHaveAttribute("aria-pressed", "true");

	await press(page, "Play demo plan");
	await expect(active(page)).toHaveText("coin_trail", { timeout: 45_000 });
	await expect.poll(() => numberOf(page, "presentationObjects")).toBe(0);
	await expect(status(page)).toHaveText("finished", { timeout: 45_000 });
	expect(await startedEvents(page)).toEqual(["run_intro", "coin_trail", "monster_wave"]);

	await press(page, "Fail assets");
	await press(page, "coin_trail");
	await expect.poll(() => numberOf(page, "presentationObjects")).toBeGreaterThan(1);
});

test("playback speed 4 plays the same events and skip moves on", async ({ page }) => {
	await openMenu(page);
	await press(page, "x4");
	await expect(page.getByTestId("presentation-speed")).toHaveText("x4");

	await press(page, "Play demo plan");
	await expect(status(page)).toHaveText("finished", { timeout: 45_000 });
	expect(await startedEvents(page)).toEqual(["run_intro", "coin_trail", "monster_wave"]);

	await press(page, "x0.5");
	await press(page, "Pause");
	await press(page, "Play demo plan");
	await press(page, "Skip event");
	await expect(active(page)).toHaveText("coin_trail");
});

test("remounting the canvas mid-event leaves one canvas, no errors and the same ticker count", async ({ page }) => {
	const errors = trackErrors(page);
	await openMenu(page);
	const listeners = await numberOf(page, "tickerListeners");

	await press(page, "Pause");
	await press(page, "Play demo plan");
	await press(page, "Skip event");
	await expect(active(page)).toHaveText("coin_trail");
	await press(page, "Remount canvas");
	await expect(canvasOf(page)).toHaveCount(1, { timeout: 30_000 });
	await expect(active(page)).toHaveText("coin_trail");

	await press(page, "Cancel");
	await expect.poll(() => numberOf(page, "presentationObjects")).toBe(0);
	await expect.poll(() => numberOf(page, "tickerListeners"), { timeout: 45_000 }).toBe(listeners);
	expect(errors).toEqual([]);
});

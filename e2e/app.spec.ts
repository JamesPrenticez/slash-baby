import { expect, test } from "@playwright/test";

import { canvasOf, expectCanvasFillsHost, trackErrors } from "./helpers";

test("mounts exactly one canvas that fills its host", async ({ page }) => {
	const errors = trackErrors(page);
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1);
	await expectCanvasFillsHost(page);
	expect(errors).toEqual([]);
});

test("the page is titled Slash Baby", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle("Slash Baby");
});

test("rotating keeps one canvas matched to its host", async ({ page }) => {
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1);

	const { width, height } = page.viewportSize()!;
	await page.setViewportSize({ width: height, height: width });

	await expect(canvasOf(page)).toHaveCount(1);
	await expectCanvasFillsHost(page);
});

test("the canvas fills its host when the stylesheet arrives late", async ({ page }) => {
	// Fonts are imported by the global sheet; held back, the first measurements happen before the reset applies.
	await page.route("**/fonts.googleapis.com/**", async route => {
		await new Promise(resolve => setTimeout(resolve, 3000));
		await route.abort();
	});
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1);
	await expectCanvasFillsHost(page);
});

test("the canvas follows its host when only the host resizes", async ({ page }) => {
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1);
	await expectCanvasFillsHost(page);

	await page.addStyleTag({ content: '[data-testid="game-canvas"]{margin-right:40px}' });

	await expectCanvasFillsHost(page);
	const host = (await page.getByTestId("game-canvas").boundingBox())!;
	expect(host.x + host.width).toBeLessThanOrEqual(page.viewportSize()!.width - 39);
});

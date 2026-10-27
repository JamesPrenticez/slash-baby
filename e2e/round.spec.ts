import { expect, type Page, test } from "@playwright/test";

import {
	API,
	canvasOf,
	expectOnScreen,
	force,
	seedPlayer,
	serverBalance,
	serverHistory,
	SLOW,
	trackErrors,
	usd
} from "./helpers";

// Software WebGL starves a page when 8 workers share the machine (TEAM 17); every test here gets the longer budget.
test.beforeEach(() => test.slow());

// Full-page screenshots are costly under software WebGL, so they are only taken for the human-review pass (SHOTS=1).
const shot = (page: Page, name: string) =>
	process.env.SHOTS === "1" ? page.screenshot({ path: test.info().outputPath(`${name}.png`) }) : undefined;

const WAGER = 100;
// Pixi caps a frame at 100 ms of plan time, so a starved page plays a 5.3 s plan in far more than 5.3 s.
const PLAN_TIMEOUT = { timeout: 100_000 };

const playButton = (page: Page) => page.getByRole("button", { name: "PLAY", exact: true });
const results = (page: Page, category: string) => page.getByRole("dialog", { name: category, exact: true });
const continueButton = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });
const debugPanel = (page: Page) => page.getByRole("region", { name: "Debug menu" });
const toggleDebug = (page: Page) => page.getByRole("button", { name: "Debug", exact: true }).click();

async function load(page: Page) {
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1, SLOW);
	await expect(playButton(page)).toBeEnabled(SLOW);
}

/** Debug playback speed x4: the plan takes a quarter of the frames, which keeps eight busy workers from starving a page. */
async function fastForward(page: Page) {
	await toggleDebug(page);
	await page.getByRole("button", { name: "x4", exact: true }).click();
	await expect(page.getByTestId("presentation-speed")).toHaveText("x4");
	await toggleDebug(page);
}

/** The outcome overlay is on screen for 800 ms of plan time; a poll can miss it, so the page records the first sighting. */
async function recordOverlay(page: Page) {
	await page.addInitScript(() => {
		const seen: { overlay?: { text: string; inViewport: boolean }; resultsAfterOverlay?: boolean } = {};
		(window as unknown as { __seen: typeof seen }).__seen = seen;
		new MutationObserver(() => {
			const overlay = document.querySelector('[data-testid="presentation-overlay"]');
			if (overlay && !seen.overlay) {
				const { x, y, width, height } = overlay.getBoundingClientRect();
				seen.overlay = {
					text: overlay.textContent ?? "",
					inViewport: x >= -0.5 && y >= -0.5 && x + width <= innerWidth + 0.5 && y + height <= innerHeight + 0.5
				};
			}
			if (document.querySelector('[role="dialog"]') && seen.resultsAfterOverlay === undefined) {
				seen.resultsAfterOverlay = Boolean(seen.overlay);
			}
		}).observe(document, { childList: true, subtree: true });
	});
}

const seenOverlay = (page: Page) =>
	page.evaluate(
		() =>
			(
				window as unknown as {
					__seen: { overlay?: { text: string; inViewport: boolean }; resultsAfterOverlay?: boolean };
				}
			).__seen
	);

/** Starts a round and waits for its results. The payout and balance on screen are checked against the server by callers. */
async function playToResults(page: Page, category: string) {
	await playButton(page).click();
	await expect(results(page, category)).toBeVisible(PLAN_TIMEOUT);
}

const shownPayout = (page: Page, category: string) => results(page, category).locator("dd").first();
const shownBalance = (page: Page, category: string) => results(page, category).locator("dd").nth(1);

test("a forced loss goes from PLAY to results, with the server's payout and balance, and Continue returns to the bet screen", async ({
	page,
	request
}) => {
	test.setTimeout(180_000);
	const errors = trackErrors(page);
	const { headers } = await seedPlayer(page, request, { balance: 5000 });
	await force(request, headers, { fixtureId: "loss_1" });
	await recordOverlay(page);
	await load(page);
	await fastForward(page);

	await playButton(page).click();
	// PLAY is busy and the bet is locked from the press until the results close.
	await expect(playButton(page)).toBeDisabled();
	await expect(playButton(page)).toHaveAttribute("aria-busy", "true");
	await expect(page.getByRole("button", { name: "Increase bet" })).toBeDisabled();
	await expect(page.getByRole("button", { name: "Decrease bet" })).toBeDisabled();
	await expect(results(page, "Loss")).toBeVisible(PLAN_TIMEOUT);

	// The full plan ran: the reveal overlay was up, inside the viewport, before the results.
	const seen = await seenOverlay(page);
	expect(seen.overlay).toEqual({ text: "Outcome reveal", inViewport: true });
	expect(seen.resultsAfterOverlay).toBe(true);

	const [{ payoutMinorUnits, roundId }] = (await serverHistory(request, headers)).rounds;
	expect(payoutMinorUnits).toBe(0);
	const round = await (await request.get(`${API}/game/round/${roundId}`, { headers, maxRetries: 3 })).json();
	expect(round.round.settlement.payoutMinorUnits).toBe(payoutMinorUnits);
	await expect(shownPayout(page, "Loss")).toHaveText(usd(payoutMinorUnits));
	expect(await serverBalance(request, headers)).toBe(5000 - WAGER + payoutMinorUnits);
	await expect(shownBalance(page, "Loss")).toHaveText(usd(await serverBalance(request, headers)));

	await expectOnScreen(results(page, "Loss").getByRole("heading", { name: "Loss" }));
	await expectOnScreen(shownPayout(page, "Loss"));
	await expectOnScreen(shownBalance(page, "Loss"));
	await expectOnScreen(continueButton(page));
	await shot(page, "results-loss");

	// The results do not close by themselves, on Escape, or on a click outside.
	await page.keyboard.press("Escape");
	await expect(results(page, "Loss")).toBeVisible();
	await continueButton(page).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(playButton(page)).toBeEnabled();
	await expect(page.getByRole("button", { name: "Increase bet" })).toBeEnabled();
	await expect(page.getByRole("list", { name: "Recent rounds" }).getByRole("listitem")).toHaveCount(1, SLOW);
	expect(errors).toEqual([]);
});

test("a forced jackpot shows the server's payout, picked in the debug menu", async ({ page, request }) => {
	const { headers } = await seedPlayer(page, request, { balance: 5000 });
	await load(page);

	await toggleDebug(page);
	await expect(debugPanel(page)).toBeVisible();
	await expect(page.getByRole("option", { name: "jackpot_1 (plan_jackpot)" })).toBeAttached(SLOW);
	await page.getByRole("combobox", { name: "Fixture" }).selectOption("jackpot_1");
	await page.getByRole("button", { name: "Force", exact: true }).click();
	await expect(page.getByTestId("round-force")).toContainText("jackpot_1");
	await page.getByRole("button", { name: "x4", exact: true }).click();
	await toggleDebug(page);

	await playToResults(page, "Jackpot");
	const [{ payoutMinorUnits }] = (await serverHistory(request, headers)).rounds;
	expect(payoutMinorUnits).toBeGreaterThan(0);
	await expect(shownPayout(page, "Jackpot")).toHaveText(usd(payoutMinorUnits));
	await expect(shownBalance(page, "Jackpot")).toHaveText(usd(await serverBalance(request, headers)));
	await expectOnScreen(continueButton(page));
	await shot(page, "results-jackpot");
});

test("playback speed 4 gives the same payout text as 1x, and the next round starts after Continue", async ({
	page,
	request
}) => {
	test.setTimeout(300_000);
	const { headers } = await seedPlayer(page, request, { balance: 5000 });
	await force(request, headers, { fixtureId: "big_win_1", sticky: true });
	await load(page);

	await playToResults(page, "Big win");
	const normal = await shownPayout(page, "Big win").textContent();
	await continueButton(page).click();

	await toggleDebug(page);
	await page.getByRole("button", { name: "x4", exact: true }).click();
	await expect(page.getByTestId("presentation-speed")).toHaveText("x4");
	await toggleDebug(page);
	await playToResults(page, "Big win");
	await expect(shownPayout(page, "Big win")).toHaveText(normal!);
	const [{ payoutMinorUnits }] = (await serverHistory(request, headers)).rounds;
	expect(normal).toBe(usd(payoutMinorUnits));
});

test("a double click on PLAY makes one round", async ({ page, request }) => {
	const { headers } = await seedPlayer(page, request, { balance: 5000 });
	await force(request, headers, { fixtureId: "loss_1" });
	let starts = 0;
	page.on("request", req => {
		if (req.method() === "POST" && req.url().endsWith("/game/play") && req.postData()?.includes('"start"')) starts++;
	});
	await load(page);
	await fastForward(page);

	await playButton(page).dblclick();
	await expect(results(page, "Loss")).toBeVisible(PLAN_TIMEOUT);
	expect(starts).toBe(1);
	expect((await serverHistory(request, headers)).total).toBe(1);
	expect(await serverBalance(request, headers)).toBe(5000 - WAGER);
});

test("a connection lost after the server accepted the bet leaves one debit after Retry", async ({ page, request }) => {
	const { headers } = await seedPlayer(page, request, { balance: 5000 });
	await force(request, headers, { fixtureId: "loss_1" });
	// The server processes the first `start` and the page never hears back: what dropAfterAccept does, on every browser
	// (Chromium silently resends a request that died on a reused connection, which would hide the failure).
	let dropped = false;
	await page.route("**/game/play", async route => {
		if (dropped || !route.request().postData()?.includes('"start"')) return route.continue();
		dropped = true;
		await route.fetch();
		await route.abort("connectionreset");
	});
	await load(page);
	await fastForward(page);

	await playButton(page).click();
	const alert = page.getByRole("alert");
	await expect(alert).toContainText("could not be reached", PLAN_TIMEOUT);
	await expect(playButton(page)).toBeDisabled();
	expect(await serverBalance(request, headers)).toBe(5000 - WAGER);
	await expectOnScreen(alert);
	await expectOnScreen(page.getByRole("button", { name: "Retry", exact: true }));
	await shot(page, "retry-banner");

	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(results(page, "Loss")).toBeVisible(PLAN_TIMEOUT);
	expect(await serverBalance(request, headers)).toBe(5000 - WAGER);
	expect((await serverHistory(request, headers)).total).toBe(1);
});

test("a failed settle offers Retry with the same key and still reaches the results", async ({ page, request }) => {
	const { headers } = await seedPlayer(page, request, { balance: 5000 });
	await force(request, headers, { fixtureId: "small_win_1" });
	await load(page);

	await toggleDebug(page);
	await page.getByRole("button", { name: "x4", exact: true }).click();
	await page.getByRole("combobox", { name: "Fail verb" }).selectOption("settle");
	await page.getByRole("spinbutton", { name: "Fail status" }).fill("503");
	await page.getByRole("button", { name: "Fail next", exact: true }).click();
	await expect(page.getByTestId("network-simulation")).toContainText('"verb":"settle"');
	await toggleDebug(page);

	await playButton(page).click();
	await expect(page.getByRole("alert")).toBeVisible(PLAN_TIMEOUT);
	await expect(results(page, "Small win")).toHaveCount(0);
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(results(page, "Small win")).toBeVisible(PLAN_TIMEOUT);
	const [{ payoutMinorUnits }] = (await serverHistory(request, headers)).rounds;
	await expect(shownPayout(page, "Small win")).toHaveText(usd(payoutMinorUnits));
	expect((await serverHistory(request, headers)).total).toBe(1);
	expect(await serverBalance(request, headers)).toBe(5000 - WAGER + payoutMinorUnits);
});

test("a refused bet shows the server's message with no Retry and PLAY stays available", async ({ page, request }) => {
	await seedPlayer(page, request, { balance: 50 });
	await load(page);

	await playButton(page).click();
	const alert = page.getByRole("alert");
	await expect(alert).toBeVisible(SLOW);
	await expect(alert).not.toHaveText("");
	await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
	await expect(playButton(page)).toBeEnabled();
	await expectOnScreen(alert);
	await shot(page, "refused-bet");
});

test("a resolved round left unsettled is settled at boot, before PLAY is enabled", async ({ page, request }) => {
	const { headers } = await seedPlayer(page, request, { balance: 5000 });
	await force(request, headers, { fixtureId: "big_win_1" });
	const started = await request.post(`${API}/game/play`, {
		headers,
		maxRetries: 3,
		data: { idempotencyKey: "e2e-boot-start-padding-key", message: { start: { wagerMinorUnits: WAGER } } }
	});
	expect((await started.json()).message.round.status).toBe("resolved");
	expect(await serverBalance(request, headers)).toBe(5000 - WAGER);

	await load(page);
	const current = await (await request.post(`${API}/game/current`, { headers, data: {}, maxRetries: 3 })).json();
	expect(current.active).toBe(false);
	const [{ payoutMinorUnits }] = (await serverHistory(request, headers)).rounds;
	expect(payoutMinorUnits).toBeGreaterThan(0);
	const balance = await serverBalance(request, headers);
	expect(balance).toBe(5000 - WAGER + payoutMinorUnits);
	await expect(page.getByText(usd(balance), { exact: true }).filter({ visible: true }).first()).toBeVisible(SLOW);
	await expect(page.getByRole("dialog")).toHaveCount(0);
});

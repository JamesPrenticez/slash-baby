import { type APIRequestContext, expect, type Locator, type Page, test } from "@playwright/test";

import { canvasOf, trackErrors } from "./helpers";

const API = "http://localhost:3001/api";
const SLOW = { timeout: 30_000 };

type Seed = { balance?: number; currency?: string; rounds?: number };

/** A fresh player per test: the browser is told its id, and the server is told what that player starts with. */
async function seedPlayer(page: Page, request: APIRequestContext, { balance, currency, rounds = 0 }: Seed = {}) {
	const playerId = `e2e-${crypto.randomUUID()}`;
	await page.addInitScript(id => localStorage.setItem("debugPlayerId", id), playerId);

	const session = await request.post(`${API}/debug/session`, { data: { playerId, currency } });
	const { sessionToken } = await session.json();
	const headers = { Authorization: `Bearer ${sessionToken}` };
	if (balance !== undefined) {
		await request.post(`${API}/debug/balance/set`, { headers, data: { balanceMinorUnits: balance } });
	}

	const payouts: number[] = [];
	for (let n = 0; n < rounds; n++) {
		const started = await request.post(`${API}/game/play`, {
			headers,
			data: { idempotencyKey: `${playerId}-start-${n}-padding`, message: { start: { wagerMinorUnits: 100 } } }
		});
		const { roundId } = await started.json();
		const settled = await request.post(`${API}/game/play`, {
			headers,
			data: { idempotencyKey: `${playerId}-settle-${n}-padding`, message: { settle: { roundId } } }
		});
		payouts.push((await settled.json()).message.round.settlement.payoutMinorUnits);
	}
	return { payouts };
}

// Full-page screenshots are costly under software WebGL, so they are only taken for the human-review pass (SHOTS=1).
const shot = (page: Page, project: string, name: string) =>
	process.env.SHOTS === "1" ? page.screenshot({ path: `test-results/shots/${project}-${name}.png` }) : undefined;

/** Runs in the page: visible, inside the viewport and topmost at its centre, in one call. */
function measure(node: Element) {
	const chain: HTMLElement[] = [];
	for (let el: HTMLElement | null = node as HTMLElement; el; el = el.parentElement) chain.push(el);
	const saved = chain.map(el => el.style.pointerEvents);
	// The top bar and the strip let presses through to the canvas, which would hide them from elementFromPoint.
	chain.forEach(el => (el.style.pointerEvents = "auto"));
	const { x, y, width, height } = node.getBoundingClientRect();
	const topmost = document.elementFromPoint(x + width / 2, y + height / 2);
	chain.forEach((el, i) => (el.style.pointerEvents = saved[i]));
	if (width === 0 || height === 0 || getComputedStyle(node).visibility === "hidden") return "not visible";
	if (x < -0.5 || y < -0.5 || x + width > innerWidth + 0.5 || y + height > innerHeight + 0.5) return "outside viewport";
	return node.contains(topmost) ? "ok" : "covered";
}

/** Atomic: one page call decides visible, in the viewport and uncovered, so nothing can change between checks. */
async function expectOnScreen(_page: Page, target: Locator) {
	await expect.poll(() => target.evaluate(measure), SLOW).toBe("ok");
}

async function expectInViewport(page: Page, target: Locator) {
	await expect(target).toBeVisible();
	const { width, height } = page.viewportSize()!;
	const box = (await target.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(-0.5);
	expect(box.y).toBeGreaterThanOrEqual(-0.5);
	expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
	expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
}

// Software WebGL starves a page when 8 workers share the machine (TEAM 17); every test here gets the longer budget.
test.beforeEach(() => test.slow());

const money = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const openMenu = (page: Page) => page.getByRole("button", { name: "Menu", exact: true }).click();
const menuRow = (page: Page, name: string) =>
	page.getByRole("dialog", { name: "Menu" }).getByText(name, { exact: true });
const debugPanel = (page: Page) => page.getByRole("region", { name: "Debug menu" });

async function load(page: Page) {
	await page.goto("/");
	await expect(canvasOf(page)).toHaveCount(1, SLOW);
	await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
}

test("the loading screen covers the page while the session boots", async ({ page, request }, testInfo) => {
	await seedPlayer(page, request);
	let release = () => {};
	const held = new Promise<void>(resolve => (release = resolve));
	await page.route("**/api/debug/session", async route => {
		await held;
		await route.continue();
	});
	await page.goto("/");

	await expectOnScreen(page, page.getByText("Slash Baby", { exact: true }));
	await expectOnScreen(page, page.getByRole("progressbar", { name: "Loading" }));
	await shot(page, testInfo.project.name, "loading");
	release();

	await expect(canvasOf(page)).toHaveCount(1, SLOW);
	await expect(page.getByRole("progressbar")).toHaveCount(0, SLOW);
});

test("the balance on screen is the server balance, in USD and in JPY", async ({ page, request }, testInfo) => {
	const errors = trackErrors(page);
	await seedPlayer(page, request, { balance: 123456 });
	await load(page);

	await expectOnScreen(page, money(page, "$1,234.56"));
	await expectOnScreen(page, page.getByRole("button", { name: "PLAY", exact: true }));
	await expectOnScreen(page, page.getByRole("button", { name: "Menu", exact: true }));
	await expectOnScreen(page, page.getByRole("button", { name: "Mute", exact: true }));
	await shot(page, testInfo.project.name, "loaded");

	// A currency with no decimals: the same minor units read as whole yen.
	await page.getByRole("button", { name: "Debug" }).click();
	await debugPanel(page).getByRole("combobox", { name: "Currency" }).selectOption({ label: "JPY (0)" });
	await debugPanel(page).getByRole("button", { name: "Switch currency" }).click();
	await expect(money(page, "¥123,456")).toBeVisible();
	await expect(page.getByText("$1,234.56")).toHaveCount(0);
	expect(errors).toEqual([]);
});

test("the recent-rounds strip shows the server's payouts", async ({ page, request }, testInfo) => {
	const { payouts } = await seedPlayer(page, request, { rounds: 3 });
	await load(page);

	const strip = page.getByRole("list", { name: "Recent rounds" });
	await expect(strip.getByRole("listitem")).toHaveCount(3, SLOW);
	const shown = await strip.getByRole("listitem").allTextContents();
	// Newest first in the DOM. Each pill is the payout the server settled with, never a client calculation.
	expect(shown).toEqual(
		payouts
			.reverse()
			.map(minor => `$${Math.trunc(minor / 100).toLocaleString("en-US")}.${String(minor % 100).padStart(2, "0")}`)
	);
	// The strip lets presses through to the canvas, so "uncovered" is checked against the one thing that shares its corner.
	const newest = strip.getByRole("listitem").first();
	await expectInViewport(page, newest);
	const pill = (await newest.boundingBox())!;
	await expect(page.getByRole("button", { name: "Debug" })).toBeVisible(SLOW);
	const toggle = (await page.getByRole("button", { name: "Debug" }).boundingBox())!;
	expect(pill.x + pill.width <= toggle.x || toggle.x + toggle.width <= pill.x || pill.y + pill.height <= toggle.y).toBe(
		true
	);
	await shot(page, testInfo.project.name, "strip");
});

test("the menu opens game info, bet history and volume, and Escape closes each", async ({
	page,
	request
}, testInfo) => {
	const errors = trackErrors(page);
	await seedPlayer(page, request, { rounds: 2 });
	await load(page);
	const project = testInfo.project.name;

	await openMenu(page);
	await expectOnScreen(page, page.getByRole("dialog", { name: "Menu" }));
	await shot(page, project, "menu");
	await menuRow(page, "Game info").click();
	const info = page.getByRole("dialog", { name: "GAME INFO" });
	await expectOnScreen(page, info);
	await expectOnScreen(page, info.getByRole("button", { name: "Close" }));
	await shot(page, project, "game-info");
	await page.keyboard.press("Escape");
	await expect(info).toHaveCount(0);

	await openMenu(page);
	await menuRow(page, "History").click();
	const history = page.getByRole("dialog", { name: "BET HISTORY" });
	await expect(history.getByRole("listitem")).toHaveCount(2, SLOW);
	await expectOnScreen(page, history.getByRole("button", { name: "Close" }));
	await shot(page, project, "bet-history");
	await page.keyboard.press("Escape");
	await expect(history).toHaveCount(0);

	// The popover auto-closes 3 s after it opens, and a starved page can lose that race between two Playwright calls. So
	// once it is open, one in-page call waits for it, measures it and closes it with Escape, all inside the 3 s.
	await page.getByRole("button", { name: /^(Mute|Unmute)$/ }).click();
	const volume = await page.evaluate(async source => {
		const measureNode = eval(`(${source})`) as (node: Element) => string;
		const deadline = performance.now() + 2500;
		let result = "volume popover never appeared";
		while (performance.now() < deadline) {
			const node = document.querySelector('[role="dialog"][aria-label="Volume"]');
			if (node) {
				result = measureNode(node);
				if (result === "ok") break;
			}
			await new Promise(requestAnimationFrame);
		}
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		return result;
	}, measure.toString());
	expect(volume).toBe("ok");
	await expect(page.getByRole("dialog", { name: "Volume" })).toHaveCount(0);
	expect(errors).toEqual([]);
});

test("a server that cannot be reached shows the error, and Retry recovers", async ({ page, request }, testInfo) => {
	await seedPlayer(page, request, { balance: 5000 });
	await page.route("http://localhost:3001/**", route => route.abort("connectionrefused"));
	await page.goto("/");

	const alert = page.getByRole("alert");
	await expect(alert).toContainText("game server could not be reached", SLOW);
	await expect(canvasOf(page)).toHaveCount(0);
	await expectOnScreen(page, alert);
	await expectOnScreen(page, page.getByRole("button", { name: "Retry" }));
	await shot(page, testInfo.project.name, "error");

	await page.unroute("http://localhost:3001/**");
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(canvasOf(page)).toHaveCount(1, SLOW);
	await expect(money(page, "$50.00")).toBeVisible();
	await expect(page.getByRole("alert")).toHaveCount(0);
});

test("after the session expires the next call succeeds without an error", async ({ page, request }) => {
	const errors = trackErrors(page);
	await seedPlayer(page, request, { balance: 1000 });
	await load(page);

	await page.getByRole("button", { name: "Debug" }).click();
	await debugPanel(page).getByRole("button", { name: "Expire session" }).click();
	await expect(debugPanel(page).getByRole("status")).toHaveText("Expire session: ok", SLOW);

	await debugPanel(page).getByRole("spinbutton", { name: "Credit (minor units)" }).fill("500");
	await debugPanel(page).getByRole("button", { name: "Credit" }).click();
	await expect(debugPanel(page).getByRole("status")).toHaveText("Credit: ok", SLOW);
	await expect(money(page, "$15.00")).toBeVisible();
	await expect(page.getByRole("alert")).toHaveCount(0);
	// The one 401 the page saw is the expired token; it is retried inside the client.
	expect(errors.filter(text => !text.includes("401"))).toEqual([]);
});

test("the debug menu sets the balance and labels the server as a mock", async ({ page, request }) => {
	await seedPlayer(page, request);
	await load(page);
	await page.getByRole("button", { name: "Debug" }).click();
	const panel = debugPanel(page);

	await expect(panel.getByText("MOCK", { exact: true })).toBeVisible();
	await expect(panel.getByText("0.2", { exact: true })).toBeVisible();
	await panel.getByRole("spinbutton", { name: "Balance (minor units)" }).fill("98765");
	await panel.getByRole("button", { name: "Set balance" }).click();
	await expect(money(page, "$987.65")).toBeVisible();
});

test("Run and Stop in the debug menu toggle without remounting the canvas", async ({ page, request }) => {
	await seedPlayer(page, request);
	await load(page);
	const canvas = await canvasOf(page).elementHandle();

	await page.getByRole("button", { name: "Debug" }).click();
	await debugPanel(page).getByRole("button", { name: "Run", exact: true }).click();
	await debugPanel(page).getByRole("button", { name: "Stop" }).click();
	await expect(debugPanel(page).getByRole("button", { name: "Run", exact: true })).toBeVisible();

	await expect(canvasOf(page)).toHaveCount(1);
	expect(await canvas!.evaluate(node => node.isConnected)).toBe(true);
});

test("with reduced motion the DOM transitions and the loading animation are off", async ({ page, request }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await seedPlayer(page, request);
	let release = () => {};
	const held = new Promise<void>(resolve => (release = resolve));
	await page.route("**/api/debug/session", async route => {
		await held;
		await route.continue();
	});
	await page.goto("/");

	const bar = page.getByRole("progressbar", { name: "Loading" });
	await expect(bar).toBeVisible();
	expect(await bar.locator("div").evaluate(node => getComputedStyle(node).animationName)).toBe("none");
	release();

	await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible(SLOW);
	await openMenu(page);
	const durations = await page.evaluate(() => {
		const seconds = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo).transitionDuration;
		const row = document.querySelector('[role="dialog"][aria-label="Menu"] button')!;
		return [
			seconds(row, "::before"),
			seconds(document.querySelector("[data-menu-toggle]")!),
			seconds(document.querySelector('[role="switch"], button[aria-label="Mute"]')!)
		];
	});
	expect(durations).toEqual(["0s", "0s", "0s"]);
});

test("the menu takes focus when it opens and gives it back on Escape", async ({ page, request }) => {
	await seedPlayer(page, request);
	await load(page);
	const toggle = page.getByRole("button", { name: "Menu", exact: true });

	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await toggle.click();
	await expect(page.getByRole("button", { name: "Close Menu" })).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("slider", { name: "Effects volume" })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
	await expect(toggle).toBeFocused();
});

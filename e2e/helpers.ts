import { type APIRequestContext, expect, type Locator, type Page } from "@playwright/test";

export const canvasOf = (page: Page) => page.locator('[data-testid="game-canvas"] canvas');

/** Collects page errors and console errors; assert the returned array is empty at the end of a test. */
export const trackErrors = (page: Page) => {
	const errors: string[] = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => message.type() === "error" && errors.push(message.text()));
	return errors;
};

export const expectCanvasFillsHost = async (page: Page) => {
	await expect(async () => {
		const host = await page.getByTestId("game-canvas").boundingBox();
		const box = await canvasOf(page).boundingBox();
		expect(Math.abs(box!.width - host!.width)).toBeLessThanOrEqual(1);
		expect(Math.abs(box!.height - host!.height)).toBeLessThanOrEqual(1);
	}).toPass();
};

export const API = "http://localhost:3001/api";
export const SLOW = { timeout: 30_000 };

type Seed = { balance?: number; currency?: string };

/**
 * A fresh player per test: the browser is told its id, and the server is told what that player starts with. Returns the
 * bearer headers of a session of its own, for reading what the server says and for setting up debug faults.
 */
export async function seedPlayer(page: Page, request: APIRequestContext, { balance, currency }: Seed = {}) {
	const playerId = `e2e-${crypto.randomUUID()}`;
	await page.addInitScript(id => localStorage.setItem("debugPlayerId", id), playerId);
	const session = await request.post(`${API}/debug/session`, { data: { playerId, currency } });
	const headers = { Authorization: `Bearer ${(await session.json()).sessionToken}` };
	if (balance !== undefined) {
		await request.post(`${API}/debug/balance/set`, { headers, data: { balanceMinorUnits: balance } });
	}
	return { playerId, headers };
}

export type AuthHeaders = { Authorization: string };

/** Forces the outcome of the next round (or every later one with `sticky`) on the server. */
export const force = (request: APIRequestContext, headers: AuthHeaders, data: Record<string, unknown>) =>
	request.post(`${API}/debug/force`, { headers, data, maxRetries: 3 });

export const serverBalance = async (request: APIRequestContext, headers: AuthHeaders) =>
	(
		(await (await request.get(`${API}/game/balance`, { headers, maxRetries: 3 })).json()) as {
			balanceMinorUnits: number;
		}
	).balanceMinorUnits;

/** The player's settled rounds as the server lists them, newest first. */
export const serverHistory = async (request: APIRequestContext, headers: AuthHeaders) =>
	(await (await request.get(`${API}/game/history?limit=50`, { headers, maxRetries: 3 })).json()) as {
		total: number;
		rounds: { roundId: string; payoutMinorUnits: number; category: string }[];
	};

/** A USD amount in minor units as the game shows it. Test-side formatting of a number the server sent. */
export const usd = (minor: number) =>
	`$${Math.floor(minor / 100).toLocaleString("en-US")}.${String(minor % 100).padStart(2, "0")}`;

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
export async function expectOnScreen(target: Locator) {
	await expect.poll(() => target.evaluate(measure), SLOW).toBe("ok");
}

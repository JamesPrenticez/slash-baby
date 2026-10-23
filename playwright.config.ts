import { defineConfig, devices } from "@playwright/test";

// Cover desktop + landscape mobile + portrait mobile, across Chrome, Firefox,
// and Safari (see ANIMO.md). Adjust the dev-server command/port per project
// (this repo's own playwright.config.ts starts both the API and frontend
// itself — copy that pattern if the project has a backend to boot too).
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: "html",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry"
	},
	webServer: {
		command: "pnpm dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI
	},
	projects: [
		{ name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
		{ name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "desktop-safari", use: { ...devices["Desktop Safari"] } },

		{ name: "mobile-portrait-chrome", use: { ...devices["Pixel 7"] } },
		{ name: "mobile-portrait-safari", use: { ...devices["iPhone 14"] } },

		{
			name: "mobile-landscape-chrome",
			use: { ...devices["Pixel 7 landscape"] }
		},
		{
			name: "mobile-landscape-safari",
			use: { ...devices["iPhone 14 landscape"] }
		}
	]
});

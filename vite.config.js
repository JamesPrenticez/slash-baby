import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	return {
		server: {
			port: env.FRONTEND_PORT || 3000,
			host: "0.0.0.0"
		},
		plugins: [react(), svgr()],
		resolve: {
			alias: {
				// Single alias for the whole tree; keep in sync with the "paths"
				// entry in tsconfig.json. Per-bucket aliases are deliberately not
				// used — one key can't collide with another by prefix.
				"@": path.resolve(import.meta.dirname, "./src")
			}
		},
		test: {
			environment: "happy-dom",
			globals: true,
			pool: "threads",
			setupFiles: ["./src/vitest.setup.ts"],
			// Tests are colocated with the code they cover, so this has to span
			// the whole tree — a glob scoped to one directory silently ignores
			// every test that follows the convention.
			include: ["src/**/*.test.{ts,tsx}"],
			coverage: {
				provider: "v8",
				// Without an explicit include, v8 only measures files a test happened
				// to import — an untested file reads as absent rather than as 0%, and
				// the thresholds below can then never fail.
				include: ["src/**/*.{ts,tsx}"],
				// Test files and the setup file are excluded so they can't pad the
				// numbers: a colocated *.test.tsx sits inside the include glob and
				// would otherwise count as 100%-covered source.
				exclude: ["src/**/*.test.{ts,tsx}", "src/vitest.setup.ts", "src/main.tsx", "src/**/*.d.ts", "src/**/index.ts"],
				// 80% is the team target. Adjust per-project only with a reason —
				// this is meant to hold, not to be lowered on friction.
				thresholds: {
					lines: 80,
					statements: 80,
					functions: 80,
					branches: 80
				}
			}
		}
	};
});

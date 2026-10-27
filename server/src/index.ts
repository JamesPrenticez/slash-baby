// MOCK Slash Baby game server: a dev-only stand-in for the real game service, not a real-money implementation.
// Run with `pnpm dev:server`. Node strips the TypeScript types itself, so there is no build step.

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { config } from "./config.ts";
import { handle } from "./http.ts";

// Route modules register themselves on import.
import "./routes/session.ts";
import "./routes/debug.ts";
import "./routes/play.ts";
import "./routes/game.ts";

const server = createServer(handle);

server.on("error", err => {
	console.error(`MOCK game server failed to start: ${err.message}`);
	process.exit(1);
});

server.listen(config.port, config.host, () => {
	const { address, port } = server.address() as AddressInfo;
	console.log(
		`MOCK Slash Baby game server (dev only, not a real-money implementation) listening on http://${address}:${port}, ` +
			`debug routes ${config.debugRoutes ? "on" : "off"}`
	);
});

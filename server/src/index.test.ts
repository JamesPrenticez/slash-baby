// Run: pnpm test:server
// Boots the real entry point as a child process: the MOCK label, the 0.0.0.0 default and a live /api/health.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./index.ts", import.meta.url));

function boot(env: Record<string, string>) {
	const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", entry], {
		env: { ...process.env, ...env },
		stdio: ["ignore", "pipe", "pipe"]
	});
	let output = "";
	child.stdout.on("data", chunk => (output += chunk));
	child.stderr.on("data", chunk => (output += chunk));
	return { child, output: () => output };
}

async function logLine(run: ReturnType<typeof boot>, pattern: RegExp) {
	for (let i = 0; i < 100 && !pattern.test(run.output()); i++) await new Promise(r => setTimeout(r, 50));
	return run.output();
}

test("the entry point boots, labels itself MOCK, listens on 0.0.0.0 and answers /api/health", async () => {
	const run = boot({ SERVER_PORT: "0", NODE_ENV: "development" });
	try {
		const out = await logLine(run, /listening on/);
		const match = /MOCK .*listening on http:\/\/0\.0\.0\.0:(\d+), debug routes on/.exec(out);
		assert.ok(match, `unexpected startup output: ${out}`);
		const res = await fetch(`http://127.0.0.1:${match[1]}/api/health`);
		assert.deepEqual(Object.keys((await res.json()) as object).sort(), ["contractVersion", "mock", "status", "uptime"]);
	} finally {
		run.child.kill();
		await once(run.child, "exit");
	}
});

test("NODE_ENV=production turns the debug routes off", async () => {
	const run = boot({ SERVER_PORT: "0", NODE_ENV: "production" });
	try {
		const out = await logLine(run, /listening on/);
		const match = /listening on http:\/\/0\.0\.0\.0:(\d+), debug routes off/.exec(out);
		assert.ok(match, `unexpected startup output: ${out}`);
		const res = await fetch(`http://127.0.0.1:${match[1]}/api/debug/state`);
		assert.equal(res.status, 404);
	} finally {
		run.child.kill();
		await once(run.child, "exit");
	}
});

test("a port that is already taken exits with a readable message instead of a stack trace", async () => {
	const first = boot({ SERVER_PORT: "0" });
	try {
		const out = await logLine(first, /listening on/);
		const port = /:(\d+),/.exec(out)?.[1];
		assert.ok(port, out);
		const second = boot({ SERVER_PORT: port });
		const [code] = await once(second.child, "exit");
		assert.equal(code, 1);
		assert.match(second.output(), /MOCK game server failed to start: .*EADDRINUSE/);
	} finally {
		first.child.kill();
		await once(first.child, "exit");
	}
});

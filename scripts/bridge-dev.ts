import { type ChildProcess, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webPort = 7766;
const bridgePort = 7767;
const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type ManagedProcess = {
	child: ChildProcess;
	name: string;
};

let shuttingDown = false;
const processes: ManagedProcess[] = [];

function launchProcess(
	name: string,
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): ManagedProcess {
	const child = spawn(command, args, {
		cwd,
		env,
		stdio: "inherit",
	});

	if (!child.pid) {
		throw new Error(`Failed to start ${name}`);
	}

	const managed = { child, name };
	processes.push(managed);

	child.on("exit", (code, signal) => {
		if (shuttingDown) {
			return;
		}

		const reason =
			signal !== null
				? `${name} exited due to signal ${signal}`
				: `${name} exited with code ${code ?? 0}`;
		void shutdown(code ?? 1, reason);
	});

	return managed;
}

async function waitForHttpReady(url: string, name: string): Promise<void> {
	const startedAt = Date.now();
	const timeoutMs = 20_000;

	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url);
			const body = await response.text();
			const matchesExpectedResponse =
				name === "CARF Axum bridge"
					? response.ok && body.includes('"ok":true')
					: response.ok &&
						body.includes("<title>CARF</title>") &&
						body.includes("/src/index.tsx");

			if (matchesExpectedResponse) {
				return;
			}
		} catch {
			// Keep polling until the timeout expires.
		}

		await new Promise((resolveDelay) => {
			setTimeout(resolveDelay, 250);
		});
	}

	throw new Error(`Timed out waiting for ${name} at ${url}`);
}

async function shutdown(exitCode: number, reason?: string): Promise<never> {
	if (shuttingDown) {
		process.exit(exitCode);
	}

	shuttingDown = true;
	if (reason) {
		console.error(reason);
	}

	for (const processEntry of processes) {
		if (!processEntry.child.killed) {
			processEntry.child.kill("SIGTERM");
		}
	}

	await new Promise((resolveDelay) => {
		setTimeout(resolveDelay, 200);
	});

	for (const processEntry of processes) {
		if (!processEntry.child.killed) {
			processEntry.child.kill("SIGKILL");
		}
	}

	process.exit(exitCode);
}

process.on("SIGINT", () => {
	void shutdown(0);
});

process.on("SIGTERM", () => {
	void shutdown(0);
});

async function main(): Promise<void> {
	const bridge = launchProcess(
		"CARF Axum bridge",
		"cargo",
		["run", "--manifest-path", "src-tauri/Cargo.toml", "--bin", "carf-bridge"],
		{
			...process.env,
			CARF_BRIDGE_ADDR: `127.0.0.1:${bridgePort}`,
		},
	);

	await waitForHttpReady(
		`http://127.0.0.1:${bridgePort}/api/health`,
		"CARF Axum bridge",
	);

	launchProcess(
		"Vite dev server",
		process.execPath,
		[
			"x",
			"vite",
			"--host",
			"127.0.0.1",
			"--port",
			String(webPort),
			"--strictPort",
		],
		{
			...process.env,
			CARF_BRIDGE_PROXY_TARGET: `http://127.0.0.1:${bridgePort}`,
		},
	);

	await waitForHttpReady(`http://127.0.0.1:${webPort}`, "Vite dev server");

	process.stdout.write(
		`\nCARF web UI is available at http://127.0.0.1:${webPort}\n`,
	);
	process.stdout.write(
		`CARF Axum API is available at http://127.0.0.1:${bridgePort}/api/health\n\n`,
	);

	if (bridge.child.exitCode !== null) {
		throw new Error("CARF Axum bridge terminated before startup completed");
	}
}

void main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	void shutdown(1, message);
});

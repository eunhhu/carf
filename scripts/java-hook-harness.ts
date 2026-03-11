type ObserveMode = "attach" | "spawn-paused";

interface Options {
  baseUrl: string;
  deviceId: string;
  packageName: string;
  className: string;
  methods: string[];
  mode: ObserveMode;
  runtime: "qjs" | "v8";
  observeMs: number;
  javaWaitMs: number;
  forceStop: boolean;
}

interface SessionInfo {
  id: string;
  pid: number;
  status: string;
}

interface HookInfo {
  id: string;
  target: string;
}

interface HookEvent {
  sessionId?: string;
  hookId: string;
  type: "enter" | "leave";
  target: string;
  args?: unknown[];
  retval?: unknown;
  timestamp?: number;
}

interface SummaryEntry {
  enters: number;
  leaves: number;
  firstArgs: string | null;
  firstRetval: string | null;
}

interface HookInstallResult {
  installed: HookInfo[];
  deferred: string[];
}

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.add(key);
      continue;
    }

    values.set(key, next);
    index += 1;
  }

  const methods = (values.get("methods") ?? "initialize,getCookie2")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (methods.length === 0) {
    throw new Error("At least one method is required");
  }

  const modeValue = values.get("mode") ?? "spawn-paused";
  if (modeValue !== "attach" && modeValue !== "spawn-paused") {
    throw new Error(`Unsupported mode: ${modeValue}`);
  }

  const runtimeValue = values.get("runtime") ?? "qjs";
  if (runtimeValue !== "qjs" && runtimeValue !== "v8") {
    throw new Error(`Unsupported runtime: ${runtimeValue}`);
  }

  return {
    baseUrl: (values.get("base-url") ?? "http://127.0.0.1:7766").replace(/\/$/, ""),
    deviceId: values.get("device-id") ?? "RFCM903J0QR",
    packageName: values.get("package") ?? "com.gameparadiso.milkchoco",
    className:
      values.get("class") ?? "com.wellbia.xigncode.XigncodeClient",
    methods,
    mode: modeValue,
    runtime: runtimeValue,
    observeMs: Number(values.get("observe-ms") ?? "15000"),
    javaWaitMs: Number(values.get("java-wait-ms") ?? "8000"),
    forceStop: flags.has("force-stop"),
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function invoke<T>(
  baseUrl: string,
  command: string,
  args: unknown,
): Promise<T> {
  const response = await fetch(`${baseUrl}/api/invoke/${command}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  const payload = (await response.json()) as
    | { data: T }
    | { error: { code?: string; message?: string } };

  if ("error" in payload) {
    const message = payload.error.message ?? `invoke failed: ${command}`;
    throw new Error(message);
  }

  return payload.data;
}

function startEventPump(
  baseUrl: string,
  onEvent: (eventName: string, payload: unknown) => void,
  signal: AbortSignal,
) : { ready: Promise<void>; done: Promise<void> } {
  let markReady!: () => void;
  let markFailed!: (error: unknown) => void;

  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    markFailed = reject;
  });

  const done = (async () => {
    const response = await fetch(`${baseUrl}/api/events`, {
      headers: {
        Accept: "text/event-stream",
      },
      signal,
    });

    if (!response.ok || response.body === null) {
      throw new Error(`Failed to open event stream: ${response.status}`);
    }

    markReady();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!signal.aborted) {
        const result = await reader.read();
        if (result.done) {
          break;
        }

        buffer += decoder.decode(result.value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          dispatchSseChunk(chunk, onEvent);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } finally {
      reader.releaseLock();
    }
  })().catch((error) => {
    markFailed(error);
    throw error;
  });

  return { ready, done };
}

function dispatchSseChunk(
  chunk: string,
  onEvent: (eventName: string, payload: unknown) => void,
): void {
  if (chunk.trim().length === 0) {
    return;
  }

  let eventName = "message";
  const dataLines: string[] = [];

  for (const rawLine of chunk.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const dataText = dataLines.join("\n");
  if (dataText.length === 0) {
    return;
  }

  try {
    onEvent(eventName, JSON.parse(dataText));
  } catch {
    onEvent(eventName, dataText);
  }
}

function stringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

async function waitForJava(baseUrl: string, sessionId: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const available = await invoke<boolean>(baseUrl, "rpc_call", {
        sessionId,
        method: "isJavaAvailable",
        params: {},
      });
      if (available) {
        return true;
      }
    } catch {
      // Ignore transient startup errors while waiting for the VM.
    }

    await sleep(250);
  }

  return false;
}

async function waitForJavaClass(
  baseUrl: string,
  sessionId: string,
  className: string,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  const filter = className.split(".").pop()?.toLowerCase() ?? className.toLowerCase();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const classes = await invoke<string[]>(baseUrl, "rpc_call", {
        sessionId,
        method: "enumerateJavaClasses",
        params: { filter },
      });
      if (classes.includes(className)) {
        return true;
      }
    } catch {
      // Ignore transient enumeration errors while the runtime is starting.
    }

    await sleep(500);
  }

  return false;
}

function isDeferredHookError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ClassNotFoundException") ||
    message.includes("Method not found") ||
    message.includes("Java runtime is not available")
  );
}

async function installHooks(
  options: Options,
  sessionId: string,
  methodNames: string[],
  allowDeferred: boolean,
): Promise<HookInstallResult> {
  const installed: HookInfo[] = [];
  const deferred: string[] = [];

  for (const methodName of methodNames) {
    try {
      const hook = await invoke<HookInfo>(options.baseUrl, "rpc_call", {
        sessionId,
        method: "hookJavaMethod",
        params: {
          className: options.className,
          methodName,
        },
      });
      installed.push(hook);
    } catch (error) {
      if (allowDeferred && isDeferredHookError(error)) {
        deferred.push(methodName);
        continue;
      }
      throw error;
    }
  }

  return { installed, deferred };
}

function forceStop(deviceId: string, packageName: string): void {
  const result = Bun.spawnSync({
    cmd: ["adb", "-s", deviceId, "shell", "am", "force-stop", packageName],
    stdout: "ignore",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const message = Buffer.from(result.stderr).toString().trim();
    throw new Error(message || `Failed to force-stop ${packageName}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  let session: SessionInfo | null = null;
  const hookIds: string[] = [];
  const hookTargetById = new Map<string, string>();
  const summaries = new Map<string, SummaryEntry>();
  const abortController = new AbortController();

  const eventPump = startEventPump(
    options.baseUrl,
    (eventName, payload) => {
      if (eventName !== "carf://hook/event") {
        return;
      }

      const event = payload as HookEvent;
      if (event.sessionId !== session?.id) {
        return;
      }
      if (!hookTargetById.has(event.hookId)) {
        return;
      }

      const target = hookTargetById.get(event.hookId) ?? event.target;
      const summary = summaries.get(target) ?? {
        enters: 0,
        leaves: 0,
        firstArgs: null,
        firstRetval: null,
      };

      if (event.type === "enter") {
        summary.enters += 1;
        if (summary.firstArgs === null && Array.isArray(event.args)) {
          summary.firstArgs = stringify(event.args);
        }
      } else {
        summary.leaves += 1;
        if (summary.firstRetval === null && event.retval !== undefined) {
          summary.firstRetval = stringify(event.retval);
        }
      }

      summaries.set(target, summary);
    },
    abortController.signal,
  );

  try {
    await eventPump.ready;

    if (options.forceStop && options.mode === "spawn-paused") {
      forceStop(options.deviceId, options.packageName);
      await sleep(1000);
    }

    if (options.mode === "spawn-paused") {
      session = await invoke<SessionInfo>(options.baseUrl, "spawn_and_attach", {
        deviceId: options.deviceId,
        options: {
          identifier: options.packageName,
          runtime: options.runtime,
          autoResume: false,
        },
      });
    } else {
      session = await invoke<SessionInfo>(options.baseUrl, "attach", {
        deviceId: options.deviceId,
        options: {
          target: options.packageName,
          runtime: options.runtime,
        },
      });
    }

    process.stdout.write(
      `Session ${session.id} (${session.status}) pid=${session.pid}\n`,
    );

    let javaReady = await waitForJava(
      options.baseUrl,
      session.id,
      options.mode === "spawn-paused" ? 1500 : options.javaWaitMs,
    );
    let pendingMethods = [...options.methods];

    if (javaReady) {
      const result = await installHooks(
        options,
        session.id,
        pendingMethods,
        options.mode === "spawn-paused",
      );
      for (const hook of result.installed) {
        hookIds.push(hook.id);
        hookTargetById.set(hook.id, hook.target);
        process.stdout.write(`Hooked ${hook.target} as ${hook.id}\n`);
      }
      pendingMethods = result.deferred;
      if (pendingMethods.length > 0) {
        process.stdout.write(
          `Deferring hooks until after resume: ${pendingMethods.join(", ")}\n`,
        );
      }
    } else {
      process.stdout.write(
        "Java was not ready before resume; startup hooks may miss early calls.\n",
      );
    }

    if (options.mode === "spawn-paused") {
      await invoke<void>(options.baseUrl, "resume", {
        sessionId: session.id,
      });
      process.stdout.write("Session resumed\n");

      if (!javaReady || pendingMethods.length > 0) {
        javaReady = await waitForJava(options.baseUrl, session.id, options.javaWaitMs);
        if (!javaReady) {
          throw new Error("Java runtime did not become available after resume");
        }

        if (pendingMethods.length > 0) {
          const classReady = await waitForJavaClass(
            options.baseUrl,
            session.id,
            options.className,
            options.javaWaitMs,
          );
          if (!classReady) {
            throw new Error(`Java class did not load: ${options.className}`);
          }
        }

        const result = await installHooks(options, session.id, pendingMethods, false);
        for (const hook of result.installed) {
          hookIds.push(hook.id);
          hookTargetById.set(hook.id, hook.target);
          process.stdout.write(`Hooked ${hook.target} as ${hook.id}\n`);
        }
        pendingMethods = result.deferred;
      }
    }

    await sleep(options.observeMs);

    process.stdout.write("\nObservation summary\n");
    for (const methodName of options.methods) {
      const target = `${options.className}.${methodName}`;
      const summary = summaries.get(target) ?? {
        enters: 0,
        leaves: 0,
        firstArgs: null,
        firstRetval: null,
      };
      process.stdout.write(
        `${target}: enter=${summary.enters} leave=${summary.leaves}\n`,
      );
      if (summary.firstArgs !== null) {
        process.stdout.write(`  first args: ${summary.firstArgs}\n`);
      }
      if (summary.firstRetval !== null) {
        process.stdout.write(`  first retval: ${summary.firstRetval}\n`);
      }
    }
  } finally {
    abortController.abort();
    await eventPump.done.catch(() => {});

    if (session !== null) {
      for (const hookId of hookIds) {
        try {
          await invoke<void>(options.baseUrl, "rpc_call", {
            sessionId: session.id,
            method: "unhookJavaMethod",
            params: { hookId },
          });
        } catch {
          // Ignore cleanup failures during observation teardown.
        }
      }

      try {
        await invoke<void>(options.baseUrl, "detach", {
          sessionId: session.id,
        });
      } catch {
        // Ignore detach failures on teardown.
      }
    }
  }
}

await main();

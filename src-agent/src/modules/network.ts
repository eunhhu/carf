import { JavaRuntime as Java } from "../bridges";
import { registerHandler } from "../rpc/router";
import { emitNetworkRequest } from "../rpc/protocol";
import {
  findExportByName,
  readByteArray,
  readUtf8String,
} from "../runtime/frida-compat";

interface NetworkHooks {
  sslRead?: InvocationListener;
  sslWrite?: InvocationListener;
  javaCleanup: Array<() => void>;
}

interface JavaConnectionState {
  id: string;
  url: string;
  method: string;
  startedAt: number;
}

const activeHooks: NetworkHooks = { javaCleanup: [] };
const javaConnections = new Map<string, JavaConnectionState>();
let capturing = false;
const MAX_PREVIEW_LENGTH = 4096;
let javaRequestCounter = 0;

function isJavaAvailable(): boolean {
  try {
    return Java.available;
  } catch {
    return false;
  }
}

function tryFindSslExport(name: string): NativePointer | null {
  const candidates = [
    "libssl.so",
    "libssl.so.3",
    "libssl.so.1.1",
    "libssl.dylib",
    "libssl.3.dylib",
    "libssl.1.1.dylib",
    "libboringssl.dylib",
    "libssl3.so",
  ];

  for (const lib of candidates) {
    const addr = findExportByName(lib, name);
    if (addr) return addr;
  }

  return findExportByName(null, name);
}

function decodePreview(buf: ArrayBuffer): string {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return decoder
    .decode(buf)
    .replace(/\0/g, "")
    .slice(0, MAX_PREVIEW_LENGTH);
}

function trimToHttpBoundary(text: string): string {
  const normalized = text.replace(/\0/g, "");
  const boundary =
    /(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+\S+\s+HTTP\/[\d.]+|HTTP\/[\d.]+\s+\d{3}\s+/m.exec(
      normalized,
    );

  if (!boundary || boundary.index == null) {
    return normalized;
  }

  return normalized.slice(boundary.index);
}

function splitHttpSections(text: string): {
  headerBlock: string;
  body: string;
} {
  const separator = /\r?\n\r?\n/.exec(text);
  if (!separator || separator.index == null) {
    return { headerBlock: text, body: "" };
  }

  return {
    headerBlock: text.slice(0, separator.index),
    body: text.slice(separator.index + separator[0].length),
  };
}

function parseHttpFromText(text: string): unknown | null {
  try {
    const normalized = trimToHttpBoundary(text);

    const requestLine =
      /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE) (\S+) HTTP\/([\d.]+)/m.exec(
        normalized,
      );
    if (requestLine) {
      const { headerBlock, body } = splitHttpSections(normalized);
      const headerLines = headerBlock.split(/\r?\n/).slice(1);
      const headers: Record<string, string> = {};
      for (const line of headerLines) {
        const colon = line.indexOf(":");
        if (colon >= 0) {
          headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
      }
      return {
        direction: "request",
        method: requestLine[1],
        path: requestLine[2],
        httpVersion: requestLine[3],
        headers,
        body: body.length > 4096 ? body.slice(0, 4096) + "\u2026" : body,
      };
    }

    const statusLine = /^HTTP\/([\d.]+) (\d{3}) (.+)/m.exec(normalized);
    if (statusLine) {
      const { headerBlock, body } = splitHttpSections(normalized);
      const headerLines = headerBlock.split(/\r?\n/).slice(1);
      const headers: Record<string, string> = {};
      for (const line of headerLines) {
        const colon = line.indexOf(":");
        if (colon >= 0) {
          headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
      }
      return {
        direction: "response",
        httpVersion: statusLine[1],
        statusCode: parseInt(statusLine[2], 10),
        statusMessage: statusLine[3],
        headers,
        body: body.length > 4096 ? body.slice(0, 4096) + "\u2026" : body,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseHttpFromBuffer(buf: ArrayBuffer): unknown | null {
  return parseHttpFromText(decodePreview(buf));
}

function toProtocol(url: string): "http" | "https" {
  return url.startsWith("http://") ? "http" : "https";
}

function nextJavaRequestId(): string {
  javaRequestCounter += 1;
  return `java-${Date.now()}-${javaRequestCounter}`;
}

function describeConnection(connection: Java.Wrapper): {
  key: string;
  url: string;
  method: string;
} {
  let key = nextJavaRequestId();
  let url = "http://unknown";
  let method = "GET";

  try {
    key = `${connection.getClass().getName().toString()}:${connection.hashCode()}`;
  } catch {
    // Fall back to an ephemeral key when the connection cannot be identified.
  }

  try {
    url = String(connection.getURL().toString());
  } catch {
    // Ignore URL lookup failures.
  }

  try {
    method = String(connection.getRequestMethod());
  } catch {
    method = "GET";
  }

  return { key, url, method };
}

function ensureJavaConnectionState(connection: Java.Wrapper): JavaConnectionState {
  const description = describeConnection(connection);
  const existing = javaConnections.get(description.key);
  if (existing) {
    existing.url = description.url;
    existing.method = description.method;
    return existing;
  }

  const created: JavaConnectionState = {
    id: nextJavaRequestId(),
    url: description.url,
    method: description.method,
    startedAt: Date.now(),
  };
  javaConnections.set(description.key, created);
  return created;
}

function emitJavaConnectionEvent(
  connection: Java.Wrapper,
  extra: Partial<{
    method: string;
    statusCode: number | null;
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    duration: number | null;
  }> = {},
): void {
  const state = ensureJavaConnectionState(connection);

  if (typeof extra.method === "string" && extra.method.length > 0) {
    state.method = extra.method;
  }

  emitNetworkRequest({
    id: state.id,
    method: state.method,
    url: state.url,
    statusCode: extra.statusCode ?? null,
    requestHeaders: extra.requestHeaders ?? {},
    responseHeaders: extra.responseHeaders ?? {},
    requestBody: null,
    responseBody: null,
    duration: extra.duration ?? null,
    protocol: toProtocol(state.url),
    source: "java",
  });
}

function headersFromOkHttp(headers: Java.Wrapper): Record<string, string> {
  const result: Record<string, string> = {};

  try {
    const size = headers.size();
    for (let i = 0; i < size; i++) {
      result[String(headers.name(i))] = String(headers.value(i));
    }
  } catch {
    // Ignore malformed header access.
  }

  return result;
}

function headersFromJavaMap(map: Java.Wrapper | null): Record<string, string> {
  if (map === null) {
    return {};
  }

  const result: Record<string, string> = {};

  try {
    const entrySet = map.entrySet();
    const iterator = entrySet.iterator();

    while (iterator.hasNext()) {
      const entry = iterator.next();
      const key = entry.getKey();
      if (key === null) {
        continue;
      }

      const value = entry.getValue();
      if (value === null) {
        result[String(key)] = "";
        continue;
      }

      if (typeof value.size === "function" && typeof value.get === "function") {
        const parts: string[] = [];
        const size = value.size();
        for (let i = 0; i < size; i++) {
          const item = value.get(i);
          parts.push(String(item));
        }
        result[String(key)] = parts.join(", ");
      } else {
        result[String(key)] = String(value);
      }
    }
  } catch {
    // Ignore malformed maps.
  }

  return result;
}

function installJavaNetworkHooks(): number {
  if (!isJavaAvailable()) {
    return 0;
  }

  let installed = 0;

  Java.performNow(() => {
    try {
      const URL = Java.use("java.net.URL");

      for (const overload of URL.openConnection.overloads) {
        overload.implementation = function (this: Java.Wrapper, ...args: unknown[]) {
          const connection = overload.call(this, ...args) as Java.Wrapper;

          try {
            const state = ensureJavaConnectionState(connection);
            state.url = String(this.toString());
            emitJavaConnectionEvent(connection);
          } catch {
            // Ignore connection inspection failures.
          }

          return connection;
        };

        activeHooks.javaCleanup.push(() => {
          overload.implementation = null;
        });
        installed += 1;
      }
    } catch {
      // java.net.URL may be unavailable in minimal runtimes.
    }

    try {
      const OkHttpClient = Java.use("okhttp3.OkHttpClient");
      const overload = OkHttpClient.newCall.overloads.find(
        (candidate) =>
          candidate.argumentTypes.length === 1 &&
          candidate.argumentTypes[0]?.className === "okhttp3.Request",
      );

      if (overload) {
        overload.implementation = function (this: unknown, request: Java.Wrapper) {
          try {
            const url = String(request.url().toString());
            emitNetworkRequest({
              method: String(request.method()),
              url,
              statusCode: null,
              requestHeaders: headersFromOkHttp(request.headers()),
              responseHeaders: {},
              requestBody: null,
              responseBody: null,
              duration: null,
              protocol: toProtocol(url),
              source: "java",
            });
          } catch {
            // Ignore request inspection failures.
          }

          return overload.call(this, request);
        };

        activeHooks.javaCleanup.push(() => {
          overload.implementation = null;
        });
        installed += 1;
      }
    } catch {
      // okhttp3 may not be present in the target process.
    }

    try {
      const HttpURLConnection = Java.use("java.net.HttpURLConnection");

      for (const overload of HttpURLConnection.setRequestMethod.overloads) {
        overload.implementation = function (this: Java.Wrapper, method: string) {
          const result = overload.call(this, method);

          try {
            emitJavaConnectionEvent(this, {
              method: String(method),
              requestHeaders: headersFromJavaMap(this.getRequestProperties()),
            });
          } catch {
            // Ignore request-method updates.
          }

          return result;
        };

        activeHooks.javaCleanup.push(() => {
          overload.implementation = null;
        });
        installed += 1;
      }
    } catch {
      // Base HttpURLConnection may not be hookable on every runtime.
    }

    for (const className of [
      "com.android.okhttp.internal.huc.HttpURLConnectionImpl",
      "com.android.okhttp.internal.huc.HttpsURLConnectionImpl",
    ]) {
      try {
        const HttpURLConnectionImpl = Java.use(className);

        for (const overload of HttpURLConnectionImpl.getInputStream.overloads) {
          overload.implementation = function (this: Java.Wrapper) {
            const startedAt = Date.now();
            let stream: Java.Wrapper | null = null;
            let thrown: unknown = null;

            try {
              stream = overload.call(this);
              return stream;
            } catch (error) {
              thrown = error;
              throw error;
            } finally {
              try {
                const statusCode =
                  thrown === null ? Number(this.getResponseCode()) : null;

                emitJavaConnectionEvent(this, {
                  requestHeaders: headersFromJavaMap(this.getRequestProperties()),
                  responseHeaders: headersFromJavaMap(this.getHeaderFields()),
                  statusCode,
                  duration: Date.now() - startedAt,
                });
              } catch {
                // Ignore connection inspection failures.
              }
            }
          };

          activeHooks.javaCleanup.push(() => {
            overload.implementation = null;
          });
          installed += 1;
        }
      } catch {
        // Some platforms only expose one concrete implementation class.
      }

      try {
        const HttpURLConnectionImpl = Java.use(className);

        for (const overload of HttpURLConnectionImpl.connect.overloads) {
          overload.implementation = function (this: Java.Wrapper) {
            const startedAt = Date.now();

            try {
              return overload.call(this);
            } finally {
              try {
                emitJavaConnectionEvent(this, {
                  requestHeaders: headersFromJavaMap(this.getRequestProperties()),
                  duration: Date.now() - startedAt,
                });
              } catch {
                // Ignore connection inspection failures.
              }
            }
          };

          activeHooks.javaCleanup.push(() => {
            overload.implementation = null;
          });
          installed += 1;
        }
      } catch {
        // Some implementations do not expose connect().
      }
    }
  });

  return installed;
}

registerHandler("startNetworkCapture", (_params: unknown) => {
  if (capturing) throw new Error("Network capture already running");

  const sslReadAddr = tryFindSslExport("SSL_read");
  const sslWriteAddr = tryFindSslExport("SSL_write");
  const javaHookCount = installJavaNetworkHooks();

  if (!sslReadAddr && !sslWriteAddr && javaHookCount === 0) {
    throw new Error(
      "SSL_read / SSL_write not found and no Java network hooks were installed"
    );
  }

  if (sslReadAddr) {
    activeHooks.sslRead = Interceptor.attach(sslReadAddr, {
      onEnter(args) {
        this.buf = args[1];
        this.ssl = args[0];
      },
      onLeave(retval) {
        const n = retval.toInt32();
        if (n <= 0) return;
        try {
          const raw = readByteArray(this.buf as NativePointer, n);
          if (!raw) return;
          const preview =
            readUtf8String(this.buf as NativePointer, n) ?? decodePreview(raw);
          const parsed = parseHttpFromText(preview) ?? parseHttpFromBuffer(raw);
          emitNetworkRequest({
            direction: "incoming",
            size: n,
            ssl: (this.ssl as NativePointer).toString(),
            threadId: Process.getCurrentThreadId(),
            http: parsed,
            preview,
          });
        } catch {
          // ignore
        }
      },
    });
  }

  if (sslWriteAddr) {
    activeHooks.sslWrite = Interceptor.attach(sslWriteAddr, {
      onEnter(args) {
        const n = args[2].toInt32();
        if (n <= 0) return;
        try {
          const raw = readByteArray(args[1], n);
          if (!raw) return;
          const preview = readUtf8String(args[1], n) ?? decodePreview(raw);
          const parsed = parseHttpFromText(preview) ?? parseHttpFromBuffer(raw);
          emitNetworkRequest({
            direction: "outgoing",
            size: n,
            ssl: args[0].toString(),
            threadId: Process.getCurrentThreadId(),
            http: parsed,
            preview,
          });
        } catch {
          // ignore
        }
      },
    });
  }

  capturing = true;
  return {
    started: true,
    hooks: {
      sslRead: sslReadAddr?.toString() ?? null,
      sslWrite: sslWriteAddr?.toString() ?? null,
      java: javaHookCount,
    },
  };
});

registerHandler("stopNetworkCapture", (_params: unknown) => {
  if (!capturing) throw new Error("Network capture is not running");

  activeHooks.sslRead?.detach();
  activeHooks.sslWrite?.detach();
  activeHooks.sslRead = undefined;
  activeHooks.sslWrite = undefined;
  for (const cleanup of activeHooks.javaCleanup.splice(0)) {
    cleanup();
  }
  javaConnections.clear();
  capturing = false;

  return { stopped: true };
});

registerHandler("isNetworkCaptureActive", (_params: unknown) => {
  return { active: capturing };
});

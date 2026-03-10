import { registerHandler } from "../rpc/router";
import { emitNetworkRequest } from "../rpc/protocol";

interface NetworkHooks {
  sslRead?: InvocationListener;
  sslWrite?: InvocationListener;
}

const activeHooks: NetworkHooks = {};
let capturing = false;

function tryFindSslExport(name: string): NativePointer | null {
  const candidates = [
    "libssl.so",
    "libssl.so.3",
    "libssl.so.1.1",
    "libssl.dylib",
    "libboringssl.dylib",
    "libssl3.so",
  ];

  for (const lib of candidates) {
    const addr = Module.findExportByName(lib, name);
    if (addr) return addr;
  }

  return Module.findExportByName(null, name);
}

function parseHttpFromBuffer(buf: ArrayBuffer): unknown | null {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const text = decoder.decode(buf);

    const requestLine =
      /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE) (.+?) HTTP\/([\d.]+)/m.exec(text);
    if (requestLine) {
      const headersEnd = text.indexOf("\r\n\r\n");
      const headerBlock = headersEnd >= 0 ? text.slice(0, headersEnd) : text;
      const headerLines = headerBlock.split("\r\n").slice(1);
      const headers: Record<string, string> = {};
      for (const line of headerLines) {
        const colon = line.indexOf(":");
        if (colon >= 0) {
          headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
      }
      const body = headersEnd >= 0 ? text.slice(headersEnd + 4) : "";
      return {
        direction: "request",
        method: requestLine[1],
        path: requestLine[2],
        httpVersion: requestLine[3],
        headers,
        body: body.length > 4096 ? body.slice(0, 4096) + "\u2026" : body,
      };
    }

    const statusLine = /^HTTP\/([\d.]+) (\d{3}) (.+)/m.exec(text);
    if (statusLine) {
      const headersEnd = text.indexOf("\r\n\r\n");
      const headerBlock = headersEnd >= 0 ? text.slice(0, headersEnd) : text;
      const headerLines = headerBlock.split("\r\n").slice(1);
      const headers: Record<string, string> = {};
      for (const line of headerLines) {
        const colon = line.indexOf(":");
        if (colon >= 0) {
          headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
      }
      const body = headersEnd >= 0 ? text.slice(headersEnd + 4) : "";
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

registerHandler("startNetworkCapture", (_params: unknown) => {
  if (capturing) throw new Error("Network capture already running");

  const sslReadAddr = tryFindSslExport("SSL_read");
  const sslWriteAddr = tryFindSslExport("SSL_write");

  if (!sslReadAddr && !sslWriteAddr) {
    throw new Error("SSL_read / SSL_write not found — no SSL library detected");
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
          const raw = Memory.readByteArray(this.buf as NativePointer, n);
          if (!raw) return;
          const parsed = parseHttpFromBuffer(raw);
          emitNetworkRequest({
            direction: "incoming",
            size: n,
            ssl: (this.ssl as NativePointer).toString(),
            threadId: Process.getCurrentThreadId(),
            http: parsed,
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
          const raw = Memory.readByteArray(args[1], n);
          if (!raw) return;
          const parsed = parseHttpFromBuffer(raw);
          emitNetworkRequest({
            direction: "outgoing",
            size: n,
            ssl: args[0].toString(),
            threadId: Process.getCurrentThreadId(),
            http: parsed,
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
    },
  };
});

registerHandler("stopNetworkCapture", (_params: unknown) => {
  if (!capturing) throw new Error("Network capture is not running");

  activeHooks.sslRead?.detach();
  activeHooks.sslWrite?.detach();
  activeHooks.sslRead = undefined;
  activeHooks.sslWrite = undefined;
  capturing = false;

  return { stopped: true };
});

registerHandler("isNetworkCaptureActive", (_params: unknown) => {
  return { active: capturing };
});

import { registerHandler } from "../rpc/router";
import { findExportByName } from "../runtime/frida-compat";

function hexEncode(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data);
  }

  throw new Error("Unsupported byte buffer type");
}

registerHandler("listDirectory", (params: unknown) => {
  const { path } = params as { path: string };

  // Use File API via enumerateEntries if available, otherwise fallback to dir commands
  // Frida's File API doesn't have a directory enumerator; we use Process.enumerateModules paths
  // as hints. For actual directory listing, we use a helper script via the file open trick.

  const entries: { name: string; type: string }[] = [];

  try {
    // Frida's SqliteDatabase approach won't work for dirs; use opendir via NativeFunction
    const libcCandidates =
      Process.platform === "darwin"
        ? ["libSystem.B.dylib"]
        : ["libc.so", "libc.so.6"];

    const resolveDirExport = (name: string): NativePointer | null => {
      for (const candidate of libcCandidates) {
        const resolved = findExportByName(candidate, name);
        if (resolved) {
          return resolved;
        }
      }

      return findExportByName(null, name);
    };

    const opendirAddr = resolveDirExport("opendir");
    const readdirAddr = resolveDirExport("readdir");
    const closedirAddr = resolveDirExport("closedir");
    if (!opendirAddr || !readdirAddr || !closedirAddr) {
      throw new Error(
        `Failed to resolve directory functions from ${libcCandidates.join(", ")}`
      );
    }

    const opendir = new NativeFunction(opendirAddr, "pointer", ["pointer"]);
    const readdir = new NativeFunction(readdirAddr, "pointer", ["pointer"]);
    const closedir = new NativeFunction(closedirAddr, "int", ["pointer"]);

    const pathMem = Memory.allocUtf8String(path);
    const dir = opendir(pathMem) as NativePointer;
    if (dir.isNull()) throw new Error(`Cannot open directory: ${path}`);

    // struct dirent layout (simplified):
    // Linux 64-bit: ino(8) off(8) reclen(2) type(1) name[256]
    // macOS:        ino(8) seekoff(8) reclen(2) len(2) type(1) name[1024]
    const isMac = Process.platform === "darwin";
    const nameOffset = isMac ? 21 : 19;

    function resolveEntryType(entryPath: string, fallbackType: string): string {
      const entryPathMem = Memory.allocUtf8String(entryPath);
      const childDir = opendir(entryPathMem) as NativePointer;
      if (!childDir.isNull()) {
        closedir(childDir);
        return "directory";
      }

      return fallbackType;
    }

    while (true) {
      const dirent = readdir(dir) as NativePointer;
      if (dirent.isNull()) break;

      const name = dirent.add(nameOffset).readUtf8String();
      if (!name || name === "." || name === "..") continue;

      const entryPath = path.endsWith("/") ? `${path}${name}` : `${path}/${name}`;
      const typeOffset = isMac ? 20 : 18;
      const dtype = dirent.add(typeOffset).readU8();

      // DT_DIR = 4, DT_REG = 8, DT_LNK = 10
      const typeMap: Record<number, string> = { 4: "directory", 8: "file", 10: "symlink" };
      const fallbackType = typeMap[dtype] ?? "file";
      entries.push({
        name,
        path: entryPath,
        type: resolveEntryType(entryPath, fallbackType),
        size: 0,
        permissions: "",
        modified: null,
      });
    }

    closedir(dir);
  } catch (e) {
    throw new Error(`listDirectory failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return entries;
});

registerHandler("readFile", (params: unknown) => {
  const { path, offset = 0, size, encoding = "hex" } = params as {
    path: string;
    offset?: number;
    size?: number;
    encoding?: "hex" | "utf8";
  };

  // Hard caps: 4 MiB for utf8 text and 4 MiB for binary chunks. Frida RPC has
  // to serialise these into a single message, and anything larger blocks the
  // Agent main loop while starving other handlers. Callers that need more
  // should paginate via `offset`+`size`.
  const READ_FILE_UTF8_MAX = 4 * 1024 * 1024;
  const READ_FILE_BIN_MAX = 4 * 1024 * 1024;

  if (encoding === "utf8") {
    const textFile = new File(path, "r");
    try {
      if (offset > 0) textFile.seek(offset);
      const text = textFile.readText();
      if (!text) return "";
      const limit = typeof size === "number" && size > 0 ? Math.min(size, READ_FILE_UTF8_MAX) : READ_FILE_UTF8_MAX;
      return text.slice(0, limit);
    } finally {
      textFile.close();
    }
  }

  const file = new File(path, "rb");
  try {
    if (offset > 0) file.seek(offset);

    const chunkSize = size ?? 64 * 1024; // default 64KB
    if (chunkSize > READ_FILE_BIN_MAX) {
      throw new Error(`Requested size exceeds ${READ_FILE_BIN_MAX} byte limit`);
    }

    const data = file.readBytes(chunkSize);
    if (!data) return "";

    const bytes = toUint8Array(data);
    return hexEncode(bytes);
  } finally {
    file.close();
  }
});

registerHandler("sqliteQuery", (params: unknown) => {
  const { path, query } = params as { path: string; query: string };

  const db = SqliteDatabase.open(path);
  try {
    const stmt = db.prepare(query);
    const columns = stmt.columnNames;
    const rows: unknown[][] = [];

    while (true) {
      const row = stmt.step();
      if (row === null) {
        break;
      }
      rows.push(row);
    }

    stmt.reset();
    return { columns, rows, rowCount: rows.length };
  } finally {
    db.close();
  }
});

registerHandler("sqliteTables", (params: unknown) => {
  const { path } = params as { path: string };

  const db = SqliteDatabase.open(path);
  try {
    const stmt = db.prepare(
      "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name"
    );
    const tables: { name: string; type: string; sql: string | null }[] = [];

    while (true) {
      const row = stmt.step();
      if (row === null) {
        break;
      }
      tables.push({
        name: row[0] as string,
        type: row[1] as string,
        sql: (row[2] as string | null) ?? null,
      });
    }

    stmt.reset();
    return tables.map((table) => table.name);
  } finally {
    db.close();
  }
});

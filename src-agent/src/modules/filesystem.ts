import { registerHandler } from "../rpc/router";

function hexEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

registerHandler("listDirectory", (params: unknown) => {
  const { path } = params as { path: string };

  // Use File API via enumerateEntries if available, otherwise fallback to dir commands
  // Frida's File API doesn't have a directory enumerator; we use Process.enumerateModules paths
  // as hints. For actual directory listing, we use a helper script via the file open trick.

  const entries: { name: string; type: string }[] = [];

  try {
    // Frida's SqliteDatabase approach won't work for dirs; use opendir via NativeFunction
    const libc = Process.platform === "darwin" ? "libSystem.B.dylib" : "libc.so.6";

    const opendirAddr = Module.findExportByName(libc, "opendir");
    const readdirAddr = Module.findExportByName(libc, "readdir");
    const closedirAddr = Module.findExportByName(libc, "closedir");
    if (!opendirAddr || !readdirAddr || !closedirAddr) {
      throw new Error(`Failed to resolve directory functions from ${libc}`);
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

    while (true) {
      const dirent = readdir(dir) as NativePointer;
      if (dirent.isNull()) break;

      const name = dirent.add(nameOffset).readUtf8String();
      if (!name || name === "." || name === "..") continue;

      const typeOffset = isMac ? 20 : 18;
      const dtype = dirent.add(typeOffset).readU8();

      // DT_DIR = 4, DT_REG = 8, DT_LNK = 10
      const typeMap: Record<number, string> = { 4: "directory", 8: "file", 10: "symlink" };
      entries.push({
        name,
        path: path.endsWith("/") ? `${path}${name}` : `${path}/${name}`,
        type: typeMap[dtype] ?? "file",
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

  const file = new File(path, "rb");
  if (offset > 0) file.seek(offset);

  const chunkSize = size ?? 64 * 1024; // default 64KB
  if (chunkSize > 64 * 1024 * 1024) throw new Error("Requested size exceeds 64MB limit");

  const data = file.readBytes(chunkSize);
  file.close();

  if (!data) return "";

  if (encoding === "utf8") {
    try {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      return decoder.decode(data as ArrayBuffer);
    } catch {
      // Fall through to hex
    }
  }

  return hexEncode(data as ArrayBuffer);
});

registerHandler("sqliteQuery", (params: unknown) => {
  const { path, query } = params as { path: string; query: string };

  const db = SqliteDatabase.open(path);
  try {
    const stmt = db.prepare(query);
    const columns = stmt.columnNames;
    const rows: unknown[][] = [];

    while (stmt.step()) {
      rows.push(columns.map((col) => stmt.get(columns.indexOf(col))));
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

    while (stmt.step()) {
      tables.push({
        name: stmt.get(0) as string,
        type: stmt.get(1) as string,
        sql: stmt.get(2) as string | null,
      });
    }

    stmt.reset();
    return tables.map((table) => table.name);
  } finally {
    db.close();
  }
});

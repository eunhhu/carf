import type { MethodHandler } from "../../rpc/types";

// File operations

// Read file contents
export const fileReadAllText: MethodHandler = ({ params }) => {
  const { path } = (params || {}) as { path?: string };

  if (!path) {
    throw new Error("path parameter is required");
  }

  try {
    const file = new File(path, "r");
    const content = File.readAllText(path);
    file.close();
    return { path, content, size: content.length };
  } catch (e) {
    throw new Error(`Failed to read file: ${e}`);
  }
};

// Read file as bytes
export const fileReadAllBytes: MethodHandler = ({ params }) => {
  const { path, limit = 4096 } = (params || {}) as { path?: string; limit?: number };

  if (!path) {
    throw new Error("path parameter is required");
  }

  try {
    const file = new File(path, "rb");
    const bytes = file.readBytes(limit);
    file.close();

    const arr = new Uint8Array(bytes);
    return {
      path,
      size: arr.length,
      bytes: Array.from(arr),
    };
  } catch (e) {
    throw new Error(`Failed to read file bytes: ${e}`);
  }
};

// Write text to file
export const fileWriteAllText: MethodHandler = ({ params }) => {
  const { path, content } = (params || {}) as { path?: string; content?: string };

  if (!path || content === undefined) {
    throw new Error("path and content parameters are required");
  }

  try {
    const file = new File(path, "w");
    file.write(content);
    file.close();
    return { path, bytesWritten: content.length };
  } catch (e) {
    throw new Error(`Failed to write file: ${e}`);
  }
};

// Write bytes to file
export const fileWriteAllBytes: MethodHandler = ({ params }) => {
  const { path, bytes } = (params || {}) as { path?: string; bytes?: number[] };

  if (!path || !bytes) {
    throw new Error("path and bytes parameters are required");
  }

  try {
    const file = new File(path, "wb");
    file.write(new Uint8Array(bytes).buffer as ArrayBuffer);
    file.close();
    return { path, bytesWritten: bytes.length };
  } catch (e) {
    throw new Error(`Failed to write file bytes: ${e}`);
  }
};

// Socket operations

// Create and connect socket
export const socketConnect: MethodHandler = ({ params }) => {
  const { host, port, family = "ipv4", type = "tcp" } = (params || {}) as {
    host?: string;
    port?: number;
    family?: string;
    type?: string;
  };

  if (!host || !port) {
    throw new Error("host and port parameters are required");
  }

  try {
    const socket = Socket.connect({
      host,
      port,
      family: family as SocketFamily,
      type: type as SocketType,
    });

    return {
      localAddress: socket.localAddress,
      peerAddress: socket.peerAddress,
    };
  } catch (e) {
    throw new Error(`Failed to connect socket: ${e}`);
  }
};

// Listen on socket
export const socketListen: MethodHandler = ({ params }) => {
  const { host = "0.0.0.0", port, family = "ipv4", type = "tcp", backlog = 10 } = (params || {}) as {
    host?: string;
    port?: number;
    family?: string;
    type?: string;
    backlog?: number;
  };

  if (!port) {
    throw new Error("port parameter is required");
  }

  try {
    const listener = Socket.listen({
      host,
      port,
      family: family as SocketFamily,
      type: type as SocketType,
      backlog,
    });

    return {
      address: listener.address,
      port: listener.port,
    };
  } catch (e) {
    throw new Error(`Failed to listen on socket: ${e}`);
  }
};

// Get socket type from file descriptor
export const socketType: MethodHandler = ({ params }) => {
  const { fd } = (params || {}) as { fd?: number };

  if (fd === undefined) {
    throw new Error("fd parameter is required");
  }

  try {
    const type = Socket.type(fd);
    return { fd, type };
  } catch (e) {
    throw new Error(`Failed to get socket type: ${e}`);
  }
};

// Get local address from file descriptor
export const socketLocalAddress: MethodHandler = ({ params }) => {
  const { fd } = (params || {}) as { fd?: number };

  if (fd === undefined) {
    throw new Error("fd parameter is required");
  }

  try {
    const address = Socket.localAddress(fd);
    return { fd, address };
  } catch (e) {
    throw new Error(`Failed to get local address: ${e}`);
  }
};

// Get peer address from file descriptor
export const socketPeerAddress: MethodHandler = ({ params }) => {
  const { fd } = (params || {}) as { fd?: number };

  if (fd === undefined) {
    throw new Error("fd parameter is required");
  }

  try {
    const address = Socket.peerAddress(fd);
    return { fd, address };
  } catch (e) {
    throw new Error(`Failed to get peer address: ${e}`);
  }
};

// SQLite operations

// Open SQLite database
export const sqliteOpen: MethodHandler = ({ params }) => {
  const { path, flags } = (params || {}) as { path?: string; flags?: number };

  if (!path) {
    throw new Error("path parameter is required");
  }

  try {
    const db = SqliteDatabase.open(path, { flags });
    return {
      path,
      handle: db.handle.toString(),
    };
  } catch (e) {
    throw new Error(`Failed to open database: ${e}`);
  }
};

// Execute SQL query
export const sqliteExec: MethodHandler = ({ params }) => {
  const { path, sql } = (params || {}) as { path?: string; sql?: string };

  if (!path || !sql) {
    throw new Error("path and sql parameters are required");
  }

  try {
    const db = SqliteDatabase.open(path);
    db.exec(sql);
    db.close();
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to execute SQL: ${e}`);
  }
};

// Prepare and execute SQL statement with results
export const sqliteQuery: MethodHandler = ({ params }) => {
  const { path, sql, args = [] } = (params || {}) as { path?: string; sql?: string; args?: unknown[] };

  if (!path || !sql) {
    throw new Error("path and sql parameters are required");
  }

  try {
    const db = SqliteDatabase.open(path);
    const stmt = db.prepare(sql);

    // Bind arguments
    for (let i = 0; i < args.length; i++) {
      stmt.bindString(i + 1, String(args[i]));
    }

    const rows: Record<string, unknown>[] = [];
    let row;
    while ((row = stmt.step()) !== null) {
      const rowData: Record<string, unknown> = {};
      for (let i = 0; i < stmt.columnCount; i++) {
        rowData[stmt.columnName(i)] = row[i];
      }
      rows.push(rowData);
    }

    stmt.reset();
    db.close();

    return { rows, count: rows.length };
  } catch (e) {
    throw new Error(`Failed to query database: ${e}`);
  }
};

// Dump database schema
export const sqliteDumpSchema: MethodHandler = ({ params }) => {
  const { path } = (params || {}) as { path?: string };

  if (!path) {
    throw new Error("path parameter is required");
  }

  try {
    const db = SqliteDatabase.open(path);
    const stmt = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'");

    const tables: { name: string; sql: string }[] = [];
    let row;
    while ((row = stmt.step()) !== null) {
      tables.push({
        name: row[0] as string,
        sql: row[1] as string,
      });
    }

    stmt.reset();
    db.close();

    return { tables };
  } catch (e) {
    throw new Error(`Failed to dump schema: ${e}`);
  }
};

/** Format byte size to human readable string */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format hex address with 0x prefix */
export function formatAddress(address: string): string {
  if (address.startsWith("0x")) return address;
  return `0x${address}`;
}

/** Format timestamp to HH:MM:SS.mmm */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  const ms_ = d.getMilliseconds().toString().padStart(3, "0");
  return `${h}:${m}:${s}.${ms_}`;
}

/** Format duration in milliseconds */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Format PID */
export function formatPid(pid: number): string {
  return pid.toString();
}

/** Truncate string with ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

/** Generate unique ID */
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

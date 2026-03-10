import { pinboardState } from "~/features/pinboard/pinboard.store";
import { hooksState } from "~/features/hooks/hooks.store";
import { consoleState } from "~/features/console/console.store";
import { activeSession } from "~/features/session/session.store";

interface ReportData {
  generatedAt: string;
  session: {
    id: string;
    processName: string;
    pid: number;
    arch: string | null;
    mode: string;
  } | null;
  hooks: {
    total: number;
    active: number;
    items: Array<{
      id: string;
      type: string;
      target: string;
      address: string | null;
      active: boolean;
      hits: number;
    }>;
  };
  pinboard: {
    total: number;
    items: Array<{
      type: string;
      name: string;
      address: string | null;
      source: string;
      tags: string[];
      memo: string;
    }>;
  };
  console: {
    total: number;
    errors: number;
    warnings: number;
  };
}

function buildReportData(): ReportData {
  const session = activeSession();
  return {
    generatedAt: new Date().toISOString(),
    session: session
      ? {
          id: session.id,
          processName: session.processName,
          pid: session.pid,
          arch: session.arch,
          mode: session.mode,
        }
      : null,
    hooks: {
      total: hooksState.hooks.length,
      active: hooksState.hooks.filter((h) => h.active).length,
      items: hooksState.hooks.map((h) => ({
        id: h.id,
        type: h.type,
        target: h.target,
        address: h.address,
        active: h.active,
        hits: h.hits,
      })),
    },
    pinboard: {
      total: pinboardState.items.length,
      items: pinboardState.items.map((p) => ({
        type: p.type,
        name: p.name,
        address: p.address,
        source: p.source,
        tags: p.tags,
        memo: p.memo,
      })),
    },
    console: {
      total: consoleState.messages.length,
      errors: consoleState.messages.filter((m) => m.level === "error").length,
      warnings: consoleState.messages.filter((m) => m.level === "warn").length,
    },
  };
}

export function exportReportJSON(): void {
  const data = buildReportData();
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, "carf-report.json", "application/json");
}

export function exportReportHTML(): void {
  const data = buildReportData();
  const html = buildHTMLReport(data);
  downloadBlob(html, "carf-report.html", "text/html");
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildHTMLReport(data: ReportData): string {
  const sessionInfo = data.session
    ? `<tr><td>Process</td><td>${esc(data.session.processName)} (PID ${data.session.pid})</td></tr>
       <tr><td>Architecture</td><td>${esc(data.session.arch ?? "unknown")}</td></tr>
       <tr><td>Mode</td><td>${esc(data.session.mode)}</td></tr>`
    : `<tr><td colspan="2">No active session</td></tr>`;

  const hookRows = data.hooks.items
    .map(
      (h) =>
        `<tr>
          <td><span class="badge badge-${esc(h.type)}">${esc(h.type)}</span></td>
          <td class="mono">${esc(h.target)}</td>
          <td class="mono">${esc(h.address ?? "-")}</td>
          <td>${h.active ? "ON" : "OFF"}</td>
          <td>${h.hits}</td>
        </tr>`,
    )
    .join("\n");

  const pinRows = data.pinboard.items
    .map(
      (p) =>
        `<tr>
          <td><span class="badge">${esc(p.type)}</span></td>
          <td class="mono">${esc(p.name)}</td>
          <td class="mono">${esc(p.address ?? "-")}</td>
          <td>${esc(p.source)}</td>
          <td>${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</td>
        </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CARF Analysis Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #a1a1aa; margin-top: 32px; border-bottom: 1px solid #27272a; padding-bottom: 8px; }
  .meta { color: #71717a; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th { text-align: left; color: #71717a; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #27272a; }
  td { padding: 5px 8px; border-bottom: 1px solid #18181b; }
  .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; background: #27272a; }
  .badge-native { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .badge-java { background: rgba(234,179,8,0.15); color: #facc15; }
  .badge-objc { background: rgba(34,197,94,0.15); color: #4ade80; }
  .tag { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 10px; background: #27272a; margin-right: 2px; }
  .stats { display: flex; gap: 24px; margin: 12px 0; }
  .stat { text-align: center; }
  .stat-value { font-size: 28px; font-weight: 600; }
  .stat-label { font-size: 11px; color: #71717a; }
</style>
</head>
<body>
<h1>CARF Analysis Report</h1>
<div class="meta">Generated: ${esc(data.generatedAt)}</div>

<h2>Session</h2>
<table>${sessionInfo}</table>

<h2>Summary</h2>
<div class="stats">
  <div class="stat"><div class="stat-value">${data.hooks.total}</div><div class="stat-label">Total Hooks</div></div>
  <div class="stat"><div class="stat-value">${data.hooks.active}</div><div class="stat-label">Active Hooks</div></div>
  <div class="stat"><div class="stat-value">${data.pinboard.total}</div><div class="stat-label">Pinned Items</div></div>
  <div class="stat"><div class="stat-value">${data.console.errors}</div><div class="stat-label">Errors</div></div>
</div>

<h2>Hooks (${data.hooks.total})</h2>
<table>
  <thead><tr><th>Type</th><th>Target</th><th>Address</th><th>Status</th><th>Hits</th></tr></thead>
  <tbody>${hookRows || "<tr><td colspan='5'>No hooks</td></tr>"}</tbody>
</table>

<h2>Pinboard (${data.pinboard.total})</h2>
<table>
  <thead><tr><th>Type</th><th>Name</th><th>Address</th><th>Source</th><th>Tags</th></tr></thead>
  <tbody>${pinRows || "<tr><td colspan='5'>No pins</td></tr>"}</tbody>
</table>

<div class="meta" style="margin-top:32px">CARF v2 &mdash; Frida Dynamic Analysis Tool</div>
</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

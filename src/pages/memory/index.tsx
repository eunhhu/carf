import { useEffect, useState, useCallback } from "react";
import { HardDrive, Search, Eye, Copy, Bookmark, Crosshair, TableIcon, Plus } from "lucide-react";
import { MemoryTable } from "./MemoryTable";
import { useMemoryStore } from "../../stores/memoryStore";
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageContent,
  Flex,
  Text,
  Code,
  Badge,
  Card,
} from "../../components/ui/Layout";
import {
  Toolbar,
  ToolbarSpacer,
} from "../../components/ui/Toolbar";
import { Button } from "../../components/ui/Button";
import { Input, Select, FormGroup, Label, FormRow } from "../../components/ui/Input";
import { Tabs, TabPanel, useTabs } from "../../components/ui/Tabs";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  EmptyState,
} from "../../components/ui/Table";
import styled from "@emotion/styled";
import { theme } from "../../styles";
import { agentRpc } from "../../features/frida";
import { ContextMenu, useContextMenu, type ContextMenuItemOrSeparator } from "../../components/ui/ContextMenu";
import { useActionStore } from "../../stores/actionStore";
import { useLibraryStore } from "../../stores/libraryStore";

// ============================================================================
// Types
// ============================================================================

export interface RangeInfo {
  base: string;
  size: number;
  protection: string;
  file?: { path: string; offset: number; size: number };
}

export interface MemoryPageProps {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
}

type ValueType = "s8" | "u8" | "s16" | "u16" | "s32" | "u32" | "s64" | "u64" | "float" | "double" | "utf8";
type NextCondition = "eq" | "changed" | "unchanged" | "increased" | "decreased";

type WatchRow = {
  watchId: string;
  address: string;
  valueType: ValueType;
  intervalMs: number;
  value: string;
  changed?: boolean;
};

type ReadIntPayload = { value?: string };
type ReadStringPayload = { value?: string | null };

// ============================================================================
// Styles (hex viewer specific)
// ============================================================================

const HexViewContainer = styled.div`
  font-family: "SF Mono", "Consolas", monospace;
  font-size: ${theme.fontSize.xs};
  background: ${theme.colors.bg.primary};
  padding: ${theme.spacing.md};
  overflow: auto;
  flex: 1;
`;

const HexRow = styled.div`
  display: flex;
  gap: 16px;
  line-height: 1.6;

  &:hover {
    background: ${theme.colors.bg.hover};
  }
`;

const HexAddress = styled.span`
  color: ${theme.colors.text.accent};
  min-width: 100px;
`;

const HexBytes = styled.span`
  color: ${theme.colors.text.primary};
  min-width: 380px;
`;

const HexAscii = styled.span`
  color: ${theme.colors.text.muted};
`;

// ============================================================================
// Component
// ============================================================================

export function MemoryPage({ hasSession, onRpcCall }: MemoryPageProps) {
  const tabs = useTabs("table");

  // Read state
  const [readAddress, setReadAddress] = useState("");
  const [readSize, setReadSize] = useState("256");
  const [readData, setReadData] = useState<number[] | null>(null);

  // Write state (uses readAddress for the address)
  const [writeData, setWriteData] = useState("");

  // Search state
  const [searchPattern, setSearchPattern] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);

  // Value scan state
  const [scanProtection, setScanProtection] = useState("r--");
  const [scanValueType, setScanValueType] = useState<ValueType>("s32");
  const [scanValue, setScanValue] = useState("");
  const [scanCondition, setScanCondition] = useState<NextCondition>("changed");
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanAddresses, setScanAddresses] = useState<string[]>([]);
  const [scanOffset, setScanOffset] = useState(0);
  const [scanPageSize] = useState(200);
  const [scanValues, setScanValues] = useState<Record<string, string>>({});
  const [scanValuesLoading, setScanValuesLoading] = useState(false);

  // Watch state
  const [watchAddress, setWatchAddress] = useState("");
  const [watchValueType, setWatchValueType] = useState<ValueType>("s32");
  const [watchIntervalMs, setWatchIntervalMs] = useState("250");
  const [watchRows, setWatchRows] = useState<WatchRow[]>([]);

  // Ranges state
  const [ranges, setRanges] = useState<RangeInfo[]>([]);
  const [rangeFilter, setRangeFilter] = useState("r--");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle pending actions from other pages (e.g., "View in Memory" from Native)
  const consumePendingAction = useActionStore((s) => s.consumePendingAction);

  useEffect(() => {
    const pendingAction = consumePendingAction();
    if (pendingAction && pendingAction.type === 'read_memory') {
      setReadAddress(pendingAction.target.address);
      tabs.onChange('hex');
      // Auto-trigger read after setting address
      setTimeout(() => {
        if (hasSession && pendingAction.target.address) {
          handleReadWithAddress(pendingAction.target.address);
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Context menu for addresses
  const addressContextMenu = useContextMenu();
  const [addressMenuItems, setAddressMenuItems] = useState<ContextMenuItemOrSeparator[]>([]);

  const buildAddressMenu = useCallback((address: string): ContextMenuItemOrSeparator[] => {
    return [
      {
        id: 'copy-address',
        label: 'Copy Address',
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(address),
      },
      { type: 'separator' },
      {
        id: 'read-at',
        label: 'Read at Address',
        icon: Eye,
        onSelect: () => handlePrefillRead(address),
      },
      {
        id: 'add-watch',
        label: 'Add Watch',
        icon: Crosshair,
        onSelect: () => handleWatchAdd(address),
      },
      { type: 'separator' },
      {
        id: 'add-to-library',
        label: 'Add to Library',
        icon: Bookmark,
        onSelect: () => {
          useLibraryStore.getState().addEntry({
            type: 'address',
            name: address,
            address: address,
            folderId: null,
            tags: [],
            starred: false,
            metadata: {},
          });
        },
      },
    ];
  }, []);

  const handleAddressContextMenu = useCallback((e: React.MouseEvent, address: string) => {
    setAddressMenuItems(buildAddressMenu(address));
    addressContextMenu.show(e, address);
  }, [addressContextMenu, buildAddressMenu]);

  // Helper to read with a specific address
  const handleReadWithAddress = useCallback(async (address: string) => {
    if (!hasSession || !address) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onRpcCall("read_memory", {
        address: address,
        size: parseInt(readSize, 10),
      });
      const payload = result as { bytes?: number[] };
      setReadData(payload.bytes ?? null);
      setReadAddress(address);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [hasSession, onRpcCall, readSize]);

  useEffect(() => {
    const unsubscribe = agentRpc.onEvent((evt) => {
      if (evt.event !== "memory_watch_update") return;

      const watchId = String(evt.watchId ?? "");
      if (!watchId) return;

      setWatchRows((prev) => {
        const next = [...prev];
        const idx = next.findIndex((r) => r.watchId === watchId);
        const updated: WatchRow = {
          watchId,
          address: String(evt.address ?? ""),
          valueType: String(evt.valueType ?? "s32") as ValueType,
          intervalMs: typeof evt.intervalMs === "number" ? evt.intervalMs : (idx >= 0 ? next[idx].intervalMs : 250),
          value: String(evt.value ?? ""),
          changed: Boolean(evt.changed),
        };

        if (idx >= 0) {
          next[idx] = { ...next[idx], ...updated };
          return next;
        }

        return [updated, ...next];
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    onRpcCall("memory_watch_list")
      .then((res) => {
        const rows = (res as Array<{ watchId: string; address: string; valueType: ValueType; intervalMs: number; lastValue: string }>).map(
          (r) => ({
            watchId: r.watchId,
            address: r.address,
            valueType: r.valueType,
            intervalMs: r.intervalMs,
            value: r.lastValue,
          })
        );
        setWatchRows(rows);
      })
      .catch(() => {
        // ignore
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  const readValueForAddress = async (address: string): Promise<string> => {
    if (scanValueType === "utf8") {
      const res = await onRpcCall("read_string", { address, encoding: "utf8", length: 64 });
      const payload = res as ReadStringPayload;
      return payload.value ?? "";
    }

    const res = await onRpcCall("read_int", { address, type: scanValueType });
    const payload = res as ReadIntPayload;
    return payload.value ?? "";
  };

  const refreshScanValues = async (addresses: string[]) => {
    if (!hasSession || addresses.length === 0) return;

    setScanValuesLoading(true);
    try {
      const pairs = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const value = await readValueForAddress(addr);
            return [addr, value] as const;
          } catch {
            return [addr, ""] as const;
          }
        })
      );

      setScanValues((prev) => {
        const next = { ...prev };
        pairs.forEach(([addr, value]) => {
          next[addr] = value;
        });
        return next;
      });
    } finally {
      setScanValuesLoading(false);
    }
  };

  const handleRead = async () => {
    if (!hasSession || !readAddress) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onRpcCall("read_memory", {
        address: readAddress,
        size: parseInt(readSize, 10),
      });
      const payload = result as { bytes?: number[] };
      setReadData(payload.bytes ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleWrite = async () => {
    if (!hasSession || !readAddress || !writeData) return;
    setLoading(true);
    setError(null);
    try {
      const bytes = writeData.split(/[\s,]+/).map((s) => parseInt(s, 16));
      await onRpcCall("write_memory", { address: readAddress, bytes });
      setError(null);
      // Re-read to show updated values
      await handleRead();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!hasSession || !searchPattern) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onRpcCall("search_memory", { pattern: searchPattern });
      const payload = result as { results?: string[] };
      setSearchResults(payload?.results ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadScanPage = async (id: string, offset: number) => {
    const res = await onRpcCall("memory_value_scan_get", { scanId: id, offset, limit: scanPageSize });
    const payload = res as { addresses?: string[] };
    const addrs = payload?.addresses ?? [];
    setScanAddresses(addrs);
    await refreshScanValues(addrs);
  };

  const handleValueScanStart = async () => {
    if (!hasSession || !scanValue) return;
    setLoading(true);
    setError(null);
    try {
      const res = await onRpcCall("memory_value_scan_start", {
        valueType: scanValueType,
        value: scanValue,
        protection: scanProtection,
        limit: 5000,
      });
      const payload = res as { scanId: string; totalMatches?: number };
      setScanId(payload.scanId);
      setScanTotal(payload.totalMatches ?? 0);
      setScanOffset(0);
      setScanValues({});
      await loadScanPage(payload.scanId, 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleValueScanNext = async () => {
    if (!hasSession || !scanId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await onRpcCall("memory_value_scan_next", {
        scanId,
        condition: scanCondition,
        value: scanCondition === "eq" ? scanValue : undefined,
      });
      const payload = res as { totalMatches?: number };
      setScanTotal(payload.totalMatches ?? 0);
      setScanOffset(0);
      setScanValues({});
      await loadScanPage(scanId, 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleValueScanClear = async () => {
    if (!hasSession || !scanId) return;
    setLoading(true);
    setError(null);
    try {
      await onRpcCall("memory_value_scan_clear", { scanId });
      setScanId(null);
      setScanTotal(0);
      setScanAddresses([]);
      setScanOffset(0);
      setScanValues({});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleScanPrevPage = async () => {
    if (!hasSession || !scanId) return;
    const nextOffset = Math.max(0, scanOffset - scanPageSize);
    setLoading(true);
    setError(null);
    try {
      setScanOffset(nextOffset);
      await loadScanPage(scanId, nextOffset);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleScanNextPage = async () => {
    if (!hasSession || !scanId) return;
    const nextOffset = scanOffset + scanPageSize;
    if (nextOffset >= scanTotal) return;
    setLoading(true);
    setError(null);
    try {
      setScanOffset(nextOffset);
      await loadScanPage(scanId, nextOffset);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handlePrefillRead = (address: string) => {
    setReadAddress(address);
    tabs.onChange("hex");
  };

  const handleWatchAdd = async (address?: string) => {
    if (!hasSession) return;
    const addr = address ?? watchAddress;
    if (!addr) return;
    setLoading(true);
    setError(null);
    try {
      const res = await onRpcCall("memory_watch_add", {
        address: addr,
        valueType: address ? scanValueType : watchValueType,
        intervalMs: parseInt(watchIntervalMs, 10) || 250,
      });
      const payload = res as { watchId: string; value?: string; address: string; valueType: ValueType; intervalMs: number };
      setWatchRows((prev) => [
        {
          watchId: payload.watchId,
          address: payload.address,
          valueType: payload.valueType,
          intervalMs: payload.intervalMs,
          value: String(payload.value ?? ""),
        },
        ...prev,
      ]);
      if (!address) setWatchAddress("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleWatchRemove = async (watchId: string) => {
    if (!hasSession) return;
    setLoading(true);
    setError(null);
    try {
      await onRpcCall("memory_watch_remove", { watchId });
      setWatchRows((prev) => prev.filter((r) => r.watchId !== watchId));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadRanges = async () => {
    if (!hasSession) return;
    setLoading(true);
    try {
      const result = await onRpcCall("enumerate_ranges", { protection: rangeFilter });
      setRanges(result as RangeInfo[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const formatHexDump = (data: number[], baseAddress: string) => {
    const rows: { address: string; bytes: string; ascii: string }[] = [];
    const base = BigInt(baseAddress);

    for (let i = 0; i < data.length; i += 16) {
      const chunk = data.slice(i, i + 16);
      const addr = "0x" + (base + BigInt(i)).toString(16).padStart(12, "0");
      const bytes = chunk.map((b) => b.toString(16).padStart(2, "0")).join(" ");
      const ascii = chunk
        .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
        .join("");
      rows.push({ address: addr, bytes, ascii });
    }
    return rows;
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Memory store for table entries
  const memoryEntryCount = useMemoryStore((s) => Object.keys(s.entries).length);

  // Add address to memory table from scan results
  const handleAddToTable = useCallback((address: string) => {
    // Convert utf8 to u32 for memory table (utf8 not supported in freeze)
    const memoryType = scanValueType === 'utf8' ? 'u32' : scanValueType;
    useMemoryStore.getState().addEntry(address, memoryType, address);
    tabs.onChange("table");
  }, [scanValueType, tabs]);

  const tabItems = [
    { id: "table", label: "Table", icon: TableIcon, badge: memoryEntryCount || undefined },
    { id: "scan", label: "Scan", icon: Search },
    { id: "hex", label: "Hex", icon: Eye },
    { id: "ranges", label: "Ranges", icon: HardDrive, badge: ranges.length || undefined },
  ];

  if (!hasSession) {
    return (
      <PageContainer>
        <EmptyState style={{ height: "100%" }}>
          <HardDrive size={48} />
          <Text $size="lg" $color="muted">No active session</Text>
          <Text $color="muted">Attach to a process to access memory</Text>
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Context Menu */}
      <ContextMenu
        items={addressMenuItems}
        position={addressContextMenu.position}
        onClose={addressContextMenu.hide}
      />

      <PageHeader>
        <Flex $align="center" $gap="12px">
          <HardDrive size={18} />
          <PageTitle>Memory</PageTitle>
        </Flex>
      </PageHeader>

      <Toolbar>
        <Tabs items={tabItems} value={tabs.value} onChange={tabs.onChange} size="sm" />
        <ToolbarSpacer />
        {error && <Badge $variant="error">{error}</Badge>}
      </Toolbar>

      <PageContent>
        {/* Table Tab - CE style multi-view */}
        <TabPanel value="table" activeTab={tabs.value}>
          <MemoryTable onRpcCall={onRpcCall} />
        </TabPanel>

        {/* Scan Tab - Value scanning with First/Next workflow */}
        <TabPanel value="scan" activeTab={tabs.value}>
          <Card $padding="16px">
            <FormRow style={{ marginBottom: 16 }}>
              <FormGroup style={{ flex: 1 }}>
                <Label>Pattern (hex with ?? wildcards)</Label>
                <Input
                  value={searchPattern}
                  onChange={(e) => setSearchPattern(e.target.value)}
                  placeholder="48 89 5C 24 ?? 48 89 74"
                  inputSize="sm"
                />
              </FormGroup>
              <Button
                variant="primary"
                onClick={handleSearch}
                disabled={loading || !searchPattern}
                style={{ alignSelf: "flex-end" }}
              >
                Search
              </Button>
            </FormRow>
          </Card>

          <Card $padding="16px" style={{ marginTop: 16 }}>
            <Text $weight="semibold" style={{ marginBottom: 12 }}>
              Value Scan (range + protection)
            </Text>
            <FormRow style={{ marginBottom: 12 }}>
              <FormGroup style={{ width: 90 }}>
                <Label>Prot</Label>
                <Input
                  value={scanProtection}
                  onChange={(e) => setScanProtection(e.target.value)}
                  placeholder="r--"
                  inputSize="sm"
                />
              </FormGroup>
              <FormGroup style={{ width: 140 }}>
                <Label>Type</Label>
                <Select
                  inputSize="sm"
                  value={scanValueType}
                  onChange={(e) => setScanValueType(e.target.value as ValueType)}
                >
                  <option value="s32">s32</option>
                  <option value="u32">u32</option>
                  <option value="s64">s64</option>
                  <option value="u64">u64</option>
                  <option value="float">float</option>
                  <option value="double">double</option>
                  <option value="utf8">utf8</option>
                </Select>
              </FormGroup>
              <FormGroup style={{ flex: 1 }}>
                <Label>Value</Label>
                <Input
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  placeholder="e.g. 100"
                  inputSize="sm"
                />
              </FormGroup>
              <Button
                size="sm"
                variant="primary"
                onClick={handleValueScanStart}
                disabled={loading || !scanValue}
                style={{ alignSelf: "flex-end" }}
              >
                First Scan
              </Button>
            </FormRow>

            <FormRow>
              <FormGroup style={{ width: 160 }}>
                <Label>Next</Label>
                <Select
                  inputSize="sm"
                  value={scanCondition}
                  onChange={(e) => setScanCondition(e.target.value as NextCondition)}
                >
                  <option value="changed">changed</option>
                  <option value="unchanged">unchanged</option>
                  <option value="increased">increased</option>
                  <option value="decreased">decreased</option>
                  <option value="eq">equals</option>
                </Select>
              </FormGroup>
              <ToolbarSpacer />
              <Text $color="muted" style={{ alignSelf: "flex-end" }}>
                {scanId ? `scanId=${scanId}  matches=${scanTotal}` : "no scan"}
              </Text>
              <Button
                size="sm"
                onClick={handleValueScanNext}
                disabled={loading || !scanId}
                style={{ alignSelf: "flex-end" }}
              >
                Next Scan
              </Button>
              <Button
                size="sm"
                onClick={() => refreshScanValues(scanAddresses)}
                disabled={loading || scanValuesLoading || scanAddresses.length === 0}
                style={{ alignSelf: "flex-end" }}
              >
                Refresh Values
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleValueScanClear}
                disabled={loading || !scanId}
                style={{ alignSelf: "flex-end" }}
              >
                Clear
              </Button>
            </FormRow>

            {scanAddresses.length > 0 && (
              <Table size="sm" hoverable style={{ marginTop: 12 }}>
                <TableHead>
                  <TableRow>
                    <TableHeader>Address</TableHeader>
                    <TableHeader width="240px">Value</TableHeader>
                    <TableHeader width="260px" align="center">Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scanAddresses.map((addr) => (
                    <TableRow
                      key={addr}
                      clickable
                      onContextMenu={(e) => handleAddressContextMenu(e, addr)}
                    >
                      <TableCell mono>{addr}</TableCell>
                      <TableCell mono truncate>{scanValues[addr] ?? ""}</TableCell>
                      <TableCell align="center">
                        <Flex $justify="center" $gap="4px">
                          <Button size="sm" variant="primary" onClick={() => handleAddToTable(addr)}>
                            <Plus size={12} style={{ marginRight: 2 }} />
                            Table
                          </Button>
                          <Button size="sm" onClick={() => handlePrefillRead(addr)}>
                            Hex
                          </Button>
                          <Button size="sm" onClick={() => handleWatchAdd(addr)}>
                            Watch
                          </Button>
                        </Flex>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {scanId && (
              <Flex $align="center" $justify="between" style={{ marginTop: 12 }}>
                <Text $color="muted">
                  {scanTotal === 0
                    ? "0 results"
                    : `Showing ${scanOffset + 1}-${Math.min(scanOffset + scanPageSize, scanTotal)} of ${scanTotal}`}
                </Text>
                <Flex $gap="8px">
                  <Button size="sm" onClick={handleScanPrevPage} disabled={loading || scanOffset === 0}>
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleScanNextPage}
                    disabled={loading || scanOffset + scanPageSize >= scanTotal}
                  >
                    Next
                  </Button>
                </Flex>
              </Flex>
            )}
          </Card>

          <Card $padding="16px" style={{ marginTop: 16 }}>
            <Text $weight="semibold" style={{ marginBottom: 12 }}>
              Watch
            </Text>
            <FormRow style={{ marginBottom: 12 }}>
              <FormGroup style={{ flex: 1 }}>
                <Label>Address</Label>
                <Input
                  value={watchAddress}
                  onChange={(e) => setWatchAddress(e.target.value)}
                  placeholder="0x..."
                  inputSize="sm"
                />
              </FormGroup>
              <FormGroup style={{ width: 140 }}>
                <Label>Type</Label>
                <Select
                  inputSize="sm"
                  value={watchValueType}
                  onChange={(e) => setWatchValueType(e.target.value as ValueType)}
                >
                  <option value="s32">s32</option>
                  <option value="u32">u32</option>
                  <option value="s64">s64</option>
                  <option value="u64">u64</option>
                  <option value="float">float</option>
                  <option value="double">double</option>
                  <option value="utf8">utf8</option>
                </Select>
              </FormGroup>
              <FormGroup style={{ width: 120 }}>
                <Label>Interval</Label>
                <Input
                  value={watchIntervalMs}
                  onChange={(e) => setWatchIntervalMs(e.target.value)}
                  placeholder="250"
                  inputSize="sm"
                />
              </FormGroup>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleWatchAdd()}
                disabled={loading || !watchAddress}
                style={{ alignSelf: "flex-end" }}
              >
                Add
              </Button>
            </FormRow>

            {watchRows.length === 0 ? (
              <Text $color="muted">No watch items</Text>
            ) : (
              <Table size="sm" hoverable>
                <TableHead>
                  <TableRow>
                    <TableHeader width="120px">Type</TableHeader>
                    <TableHeader>Address</TableHeader>
                    <TableHeader width="220px">Value</TableHeader>
                    <TableHeader width="120px" align="center">Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {watchRows.map((row) => (
                    <TableRow key={row.watchId}>
                      <TableCell mono>{row.valueType}</TableCell>
                      <TableCell mono truncate>{row.address}</TableCell>
                      <TableCell mono>
                        {row.changed ? <Badge $variant="warning">changed</Badge> : <Badge>stable</Badge>}
                        <span style={{ marginLeft: 8 }}>{row.value}</span>
                      </TableCell>
                      <TableCell align="center">
                        <Button size="sm" variant="danger" onClick={() => handleWatchRemove(row.watchId)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {searchResults.length > 0 && (
            <Card $padding="16px" style={{ marginTop: 16 }}>
              <Text $weight="semibold" style={{ marginBottom: 8 }}>
                Found {searchResults.length} matches
              </Text>
              <Flex $direction="column" $gap="4px">
                {searchResults.slice(0, 100).map((addr, i) => (
                  <Code key={i}>{addr}</Code>
                ))}
                {searchResults.length > 100 && (
                  <Text $color="muted">...and {searchResults.length - 100} more</Text>
                )}
              </Flex>
            </Card>
          )}
        </TabPanel>

        {/* Hex Tab - Read/Write memory */}
        <TabPanel value="hex" activeTab={tabs.value}>
          <Card $padding="16px">
            <FormRow style={{ marginBottom: 16 }}>
              <FormGroup style={{ flex: 1 }}>
                <Label>Address</Label>
                <Input
                  value={readAddress}
                  onChange={(e) => setReadAddress(e.target.value)}
                  placeholder="0x..."
                  inputSize="sm"
                />
              </FormGroup>
              <FormGroup style={{ width: 100 }}>
                <Label>Size</Label>
                <Input
                  value={readSize}
                  onChange={(e) => setReadSize(e.target.value)}
                  placeholder="256"
                  inputSize="sm"
                />
              </FormGroup>
              <Button
                variant="primary"
                onClick={handleRead}
                disabled={loading || !readAddress}
                style={{ alignSelf: "flex-end" }}
              >
                Read
              </Button>
            </FormRow>

            {/* Write section */}
            <FormGroup style={{ marginBottom: 16 }}>
              <Label>Write Data (hex bytes, space or comma separated)</Label>
              <FormRow>
                <Input
                  value={writeData}
                  onChange={(e) => setWriteData(e.target.value)}
                  placeholder="90 90 90 or 90,90,90"
                  inputSize="sm"
                  style={{ flex: 1 }}
                />
                <Button
                  variant="danger"
                  onClick={handleWrite}
                  disabled={loading || !readAddress || !writeData}
                >
                  Write
                </Button>
              </FormRow>
            </FormGroup>
          </Card>

          {readData && (
            <HexViewContainer style={{ marginTop: 16 }}>
              {formatHexDump(readData, readAddress).map((row, i) => (
                <HexRow key={i}>
                  <HexAddress>{row.address}</HexAddress>
                  <HexBytes>{row.bytes}</HexBytes>
                  <HexAscii>{row.ascii}</HexAscii>
                </HexRow>
              ))}
            </HexViewContainer>
          )}
        </TabPanel>

        <TabPanel value="ranges" activeTab={tabs.value}>
          <Toolbar>
            <FormGroup>
              <Input
                value={rangeFilter}
                onChange={(e) => setRangeFilter(e.target.value)}
                placeholder="r-x"
                inputSize="sm"
                style={{ width: 80 }}
              />
            </FormGroup>
            <Button size="sm" onClick={handleLoadRanges} disabled={loading}>
              Load Ranges
            </Button>
            <ToolbarSpacer />
            <Text $color="muted">{ranges.length} ranges</Text>
          </Toolbar>

          {ranges.length === 0 ? (
            <EmptyState>
              <HardDrive size={32} />
              <Text $color="muted">No ranges loaded</Text>
            </EmptyState>
          ) : (
            <Table size="sm" hoverable>
              <TableHead>
                <TableRow>
                  <TableHeader width="140px">Base</TableHeader>
                  <TableHeader width="100px" align="right">Size</TableHeader>
                  <TableHeader width="60px">Prot</TableHeader>
                  <TableHeader>File</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {ranges.map((range, i) => (
                  <TableRow key={i}>
                    <TableCell mono>{range.base}</TableCell>
                    <TableCell align="right">{formatSize(range.size)}</TableCell>
                    <TableCell>
                      <Badge>{range.protection}</Badge>
                    </TableCell>
                    <TableCell truncate>{range.file?.path || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
      </PageContent>
    </PageContainer>
  );
}

import { useState, useMemo, useCallback } from "react";
import { Cpu, Package, FileCode, RefreshCw, Copy, Eye, Bookmark, Anchor } from "lucide-react";
import { HooksPanel } from "./HooksPanel";
import { useHookStore } from "../../stores/hookStore";
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageContent,
  Flex,
  Text,
  Badge,
  Spinner,
} from "../../components/ui/Layout";
import {
  Toolbar,
  ToolbarSearch,
  ToolbarCount,
  ToolbarGroup,
  ToolbarSpacer,
} from "../../components/ui/Toolbar";
import { Button, IconButton } from "../../components/ui/Button";
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
import { ContextMenu, useContextMenu, type ContextMenuItemOrSeparator } from "../../components/ui/ContextMenu";
import { useActionStore, buildFunctionContextMenu } from "../../stores/actionStore";
import { useLibraryStore } from "../../stores/libraryStore";

// ============================================================================
// Types
// ============================================================================

export interface ModuleInfo {
  name: string;
  base: string;
  size: number;
  path: string;
}

export interface ExportInfo {
  type: string;
  name: string;
  address: string;
}

export interface ImportInfo {
  type: string;
  name: string;
  module: string;
  address: string;
}

export interface NativePageProps {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
}

// ============================================================================
// Component
// ============================================================================

export function NativePage({ hasSession, onRpcCall }: NativePageProps) {
  const tabs = useTabs("modules");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Module state
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [selectedModule, setSelectedModule] = useState<ModuleInfo | null>(null);

  // Export/Import state
  const [exports, setExports] = useState<ExportInfo[]>([]);
  const [imports, setImports] = useState<ImportInfo[]>([]);

  const filteredModules = useMemo(() => {
    if (!search) return modules;
    const lower = search.toLowerCase();
    return modules.filter(
      (m) => m.name.toLowerCase().includes(lower) || m.path.toLowerCase().includes(lower)
    );
  }, [modules, search]);

  const filteredExports = useMemo(() => {
    if (!search) return exports;
    const lower = search.toLowerCase();
    return exports.filter((e) => e.name.toLowerCase().includes(lower));
  }, [exports, search]);

  const filteredImports = useMemo(() => {
    if (!search) return imports;
    const lower = search.toLowerCase();
    return imports.filter((i) => i.name.toLowerCase().includes(lower));
  }, [imports, search]);

  const loadModules = async () => {
    if (!hasSession) return;
    setLoading(true);
    try {
      const result = await onRpcCall("enumerate_modules");
      setModules(result as ModuleInfo[]);
    } catch (e) {
      console.error("Failed to load modules:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadExports = async (moduleName: string) => {
    if (!hasSession) return;
    setLoading(true);
    try {
      const result = await onRpcCall("enumerate_exports", { module: moduleName });
      setExports(result as ExportInfo[]);
    } catch (e) {
      console.error("Failed to load exports:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadImports = async (moduleName: string) => {
    if (!hasSession) return;
    setLoading(true);
    try {
      const result = await onRpcCall("enumerate_imports", { module: moduleName });
      setImports(result as ImportInfo[]);
    } catch (e) {
      console.error("Failed to load imports:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleSelect = (module: ModuleInfo) => {
    setSelectedModule(module);
    loadExports(module.name);
    loadImports(module.name);
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Context menu for exports
  const exportContextMenu = useContextMenu();
  const [contextMenuItems, setContextMenuItems] = useState<ContextMenuItemOrSeparator[]>([]);

  const handleExportContextMenu = useCallback(
    (e: React.MouseEvent, exp: ExportInfo) => {
      const items = buildFunctionContextMenu(
        exp.name,
        exp.address,
        selectedModule?.name,
        hasSession
      );
      setContextMenuItems(items);
      exportContextMenu.show(e, exp);
    },
    [exportContextMenu, selectedModule, hasSession]
  );

  // Context menu for modules
  const moduleContextMenu = useContextMenu();
  const [moduleMenuItems, setModuleMenuItems] = useState<ContextMenuItemOrSeparator[]>([]);

  const handleModuleContextMenu = useCallback(
    (e: React.MouseEvent, module: ModuleInfo) => {
      const items: ContextMenuItemOrSeparator[] = [
        {
          id: 'copy-base',
          label: 'Copy Base Address',
          icon: Copy,
          onSelect: () => navigator.clipboard.writeText(module.base),
        },
        {
          id: 'copy-name',
          label: 'Copy Module Name',
          icon: Copy,
          onSelect: () => navigator.clipboard.writeText(module.name),
        },
        {
          id: 'copy-path',
          label: 'Copy Path',
          icon: Copy,
          onSelect: () => navigator.clipboard.writeText(module.path),
        },
        { type: 'separator' },
        {
          id: 'view-memory',
          label: 'View in Memory',
          icon: Eye,
          disabled: !hasSession,
          onSelect: () => {
            useActionStore.getState().navigateToMemory(module.base, module.name);
          },
        },
        { type: 'separator' },
        {
          id: 'add-to-library',
          label: 'Add to Library',
          icon: Bookmark,
          onSelect: () => {
            useLibraryStore.getState().addEntry({
              type: 'module',
              name: module.name,
              address: module.base,
              folderId: null,
              tags: [],
              starred: false,
              metadata: { path: module.path, size: module.size },
            });
          },
        },
      ];
      setModuleMenuItems(items);
      moduleContextMenu.show(e, module);
    },
    [moduleContextMenu, hasSession]
  );

  // Hook store for badge count
  const hookCount = useHookStore((s) => Object.keys(s.hooks).length);

  const tabItems = [
    { id: "modules", label: "Modules", icon: Package, badge: modules.length || undefined },
    { id: "exports", label: "Exports", icon: FileCode, badge: exports.length || undefined },
    { id: "imports", label: "Imports", icon: FileCode, badge: imports.length || undefined },
    { id: "hooks", label: "Hooks", icon: Anchor, badge: hookCount || undefined },
  ];

  if (!hasSession) {
    return (
      <PageContainer>
        <EmptyState style={{ height: "100%" }}>
          <Cpu size={48} />
          <Text $size="lg" $color="muted">No active session</Text>
          <Text $color="muted">Attach to a process to view native information</Text>
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Context Menus */}
      <ContextMenu
        items={contextMenuItems}
        position={exportContextMenu.position}
        onClose={exportContextMenu.hide}
      />
      <ContextMenu
        items={moduleMenuItems}
        position={moduleContextMenu.position}
        onClose={moduleContextMenu.hide}
      />

      <PageHeader>
        <Flex $align="center" $gap="12px">
          <Cpu size={18} />
          <PageTitle>Native</PageTitle>
          {selectedModule && (
            <Badge $variant="primary">{selectedModule.name}</Badge>
          )}
        </Flex>
      </PageHeader>

      <Toolbar>
        <Tabs items={tabItems} value={tabs.value} onChange={tabs.onChange} size="sm" />
        <ToolbarSpacer />
        <ToolbarSearch
          value={search}
          onChange={setSearch}
          placeholder={`Filter ${tabs.value}...`}
        />
        <ToolbarCount
          total={
            tabs.value === "modules"
              ? modules.length
              : tabs.value === "exports"
              ? exports.length
              : imports.length
          }
          filtered={
            tabs.value === "modules"
              ? filteredModules.length
              : tabs.value === "exports"
              ? filteredExports.length
              : filteredImports.length
          }
        />
        <ToolbarGroup>
          <IconButton
            icon={RefreshCw}
            size="sm"
            onClick={loadModules}
            disabled={loading}
            tooltip="Refresh modules"
          />
        </ToolbarGroup>
      </Toolbar>

      <PageContent style={{ padding: 0 }}>
        {loading ? (
          <EmptyState>
            <Spinner />
            <Text $color="muted">Loading...</Text>
          </EmptyState>
        ) : (
          <>
            <TabPanel value="modules" activeTab={tabs.value}>
              {filteredModules.length === 0 ? (
                <EmptyState>
                  <Package size={32} />
                  <Text $color="muted">No modules loaded</Text>
                  <Button size="sm" onClick={loadModules}>
                    Load Modules
                  </Button>
                </EmptyState>
              ) : (
                <Table size="sm" hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Name</TableHeader>
                      <TableHeader width="120px">Base</TableHeader>
                      <TableHeader width="80px" align="right">Size</TableHeader>
                      <TableHeader>Path</TableHeader>
                      <TableHeader width="60px" align="center">Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredModules.map((module) => (
                      <TableRow
                        key={module.base}
                        selected={selectedModule?.base === module.base}
                        clickable
                        onClick={() => handleModuleSelect(module)}
                        onContextMenu={(e) => handleModuleContextMenu(e, module)}
                      >
                        <TableCell>{module.name}</TableCell>
                        <TableCell mono>{module.base}</TableCell>
                        <TableCell align="right">{formatSize(module.size)}</TableCell>
                        <TableCell truncate>{module.path}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            icon={Copy}
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(module.base);
                            }}
                            tooltip="Copy base address"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabPanel>

            <TabPanel value="exports" activeTab={tabs.value}>
              {!selectedModule ? (
                <EmptyState>
                  <FileCode size={32} />
                  <Text $color="muted">Select a module to view exports</Text>
                </EmptyState>
              ) : filteredExports.length === 0 ? (
                <EmptyState>
                  <FileCode size={32} />
                  <Text $color="muted">No exports found</Text>
                </EmptyState>
              ) : (
                <Table size="sm" hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeader width="80px">Type</TableHeader>
                      <TableHeader>Name</TableHeader>
                      <TableHeader width="140px">Address</TableHeader>
                      <TableHeader width="60px" align="center">Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredExports.map((exp, i) => (
                      <TableRow
                        key={i}
                        clickable
                        onContextMenu={(e) => handleExportContextMenu(e, exp)}
                      >
                        <TableCell>
                          <Badge $variant={exp.type === "function" ? "primary" : "default"}>
                            {exp.type}
                          </Badge>
                        </TableCell>
                        <TableCell mono truncate>{exp.name}</TableCell>
                        <TableCell mono>{exp.address}</TableCell>
                        <TableCell align="center">
                          <Flex $gap="2px" $justify="center">
                            <IconButton
                              icon={Copy}
                              size="xs"
                              onClick={() => copyToClipboard(exp.address)}
                              tooltip="Copy address"
                            />
                            <IconButton
                              icon={Eye}
                              size="xs"
                              onClick={() => useActionStore.getState().navigateToMemory(exp.address, exp.name)}
                              tooltip="View in Memory"
                            />
                            <IconButton
                              icon={Bookmark}
                              size="xs"
                              onClick={() => useLibraryStore.getState().addEntry({
                                type: exp.type === 'function' ? 'function' : 'address',
                                name: exp.name,
                                address: exp.address,
                                module: selectedModule?.name,
                                folderId: null,
                                tags: [],
                                starred: false,
                                metadata: {},
                              })}
                              tooltip="Add to Library"
                            />
                          </Flex>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabPanel>

            <TabPanel value="imports" activeTab={tabs.value}>
              {!selectedModule ? (
                <EmptyState>
                  <FileCode size={32} />
                  <Text $color="muted">Select a module to view imports</Text>
                </EmptyState>
              ) : filteredImports.length === 0 ? (
                <EmptyState>
                  <FileCode size={32} />
                  <Text $color="muted">No imports found</Text>
                </EmptyState>
              ) : (
                <Table size="sm" hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeader width="80px">Type</TableHeader>
                      <TableHeader>Name</TableHeader>
                      <TableHeader width="120px">Module</TableHeader>
                      <TableHeader width="140px">Address</TableHeader>
                      <TableHeader width="80px" align="center">Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredImports.map((imp, i) => (
                      <TableRow key={i} clickable>
                        <TableCell>
                          <Badge $variant={imp.type === "function" ? "primary" : "default"}>
                            {imp.type}
                          </Badge>
                        </TableCell>
                        <TableCell mono truncate>{imp.name}</TableCell>
                        <TableCell>{imp.module}</TableCell>
                        <TableCell mono>{imp.address}</TableCell>
                        <TableCell align="center">
                          <Flex $gap="2px" $justify="center">
                            <IconButton
                              icon={Copy}
                              size="xs"
                              onClick={() => copyToClipboard(imp.address)}
                              tooltip="Copy address"
                            />
                            <IconButton
                              icon={Eye}
                              size="xs"
                              onClick={() => useActionStore.getState().navigateToMemory(imp.address, imp.name)}
                              tooltip="View in Memory"
                            />
                            <IconButton
                              icon={Bookmark}
                              size="xs"
                              onClick={() => useLibraryStore.getState().addEntry({
                                type: imp.type === 'function' ? 'function' : 'address',
                                name: imp.name,
                                address: imp.address,
                                module: imp.module,
                                folderId: null,
                                tags: [],
                                starred: false,
                                metadata: {},
                              })}
                              tooltip="Add to Library"
                            />
                          </Flex>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabPanel>

            <TabPanel value="hooks" activeTab={tabs.value}>
              <HooksPanel onRpcCall={onRpcCall} />
            </TabPanel>
          </>
        )}
      </PageContent>
    </PageContainer>
  );
}

import { useState, useMemo, useCallback } from "react";
import { Coffee, RefreshCw, Copy, Bookmark, Crosshair } from "lucide-react";
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
import { useLibraryStore } from "../../stores/libraryStore";

// ============================================================================
// Types
// ============================================================================

export interface JavaPageProps {
  hasSession?: boolean;
  onRpcCall?: (method: string, params?: unknown) => Promise<unknown>;
}

// ============================================================================
// Component
// ============================================================================

export function JavaPage({ hasSession = false, onRpcCall }: JavaPageProps) {
  const tabs = useTabs("classes");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [methods, setMethods] = useState<string[]>([]);

  const filteredClasses = useMemo(() => {
    if (!search) return classes;
    const lower = search.toLowerCase();
    return classes.filter((c) => c.toLowerCase().includes(lower));
  }, [classes, search]);

  const checkAvailable = async () => {
    if (!onRpcCall) return;
    try {
      const result = await onRpcCall("java_available");
      setAvailable(result as boolean);
    } catch {
      setAvailable(false);
    }
  };

  const loadClasses = async () => {
    if (!onRpcCall) return;
    setLoading(true);
    try {
      const result = await onRpcCall("java_enumerate_loaded_classes");
      setClasses(result as string[]);
    } catch (e) {
      console.error("Failed to load classes:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMethods = async (className: string) => {
    if (!onRpcCall) return;
    try {
      const result = await onRpcCall("java_get_class_methods", { className });
      setMethods((result as { name: string }[]).map((m) => m.name));
    } catch (e) {
      console.error("Failed to load methods:", e);
    }
  };

  const handleClassSelect = (className: string) => {
    setSelectedClass(className);
    loadMethods(className);
  };

  // Context menu for classes
  const classContextMenu = useContextMenu();
  const [classMenuItems, setClassMenuItems] = useState<ContextMenuItemOrSeparator[]>([]);

  const handleClassContextMenu = useCallback(
    (e: React.MouseEvent, className: string) => {
      const items: ContextMenuItemOrSeparator[] = [
        {
          id: 'copy-class',
          label: 'Copy Class Name',
          icon: Copy,
          onSelect: () => navigator.clipboard.writeText(className),
        },
        { type: 'separator' },
        {
          id: 'add-to-library',
          label: 'Add to Library',
          icon: Bookmark,
          onSelect: () => {
            useLibraryStore.getState().addEntry({
              type: 'class',
              name: className,
              folderId: null,
              tags: ['java'],
              starred: false,
              metadata: { runtime: 'java' },
            });
          },
        },
      ];
      setClassMenuItems(items);
      classContextMenu.show(e, className);
    },
    [classContextMenu]
  );

  // Context menu for methods
  const methodContextMenu = useContextMenu();
  const [methodMenuItems, setMethodMenuItems] = useState<ContextMenuItemOrSeparator[]>([]);

  const handleMethodContextMenu = useCallback(
    (e: React.MouseEvent, methodName: string) => {
      const items: ContextMenuItemOrSeparator[] = [
        {
          id: 'copy-method',
          label: 'Copy Method',
          icon: Copy,
          onSelect: () => navigator.clipboard.writeText(methodName),
        },
        {
          id: 'copy-full',
          label: 'Copy Full Signature',
          icon: Copy,
          onSelect: () => {
            const full = selectedClass ? `${selectedClass}.${methodName}` : methodName;
            navigator.clipboard.writeText(full);
          },
        },
        { type: 'separator' },
        {
          id: 'hook-method',
          label: 'Hook Method',
          icon: Crosshair,
          disabled: !hasSession,
          onSelect: () => {
            // TODO: Implement hook action
            console.log('Hook:', selectedClass, methodName);
          },
        },
        { type: 'separator' },
        {
          id: 'add-to-library',
          label: 'Add to Library',
          icon: Bookmark,
          onSelect: () => {
            useLibraryStore.getState().addEntry({
              type: 'method',
              name: methodName,
              module: selectedClass ?? undefined,
              folderId: null,
              tags: ['java'],
              starred: false,
              metadata: { runtime: 'java', className: selectedClass },
            });
          },
        },
      ];
      setMethodMenuItems(items);
      methodContextMenu.show(e, methodName);
    },
    [methodContextMenu, selectedClass, hasSession]
  );

  const tabItems = [
    { id: "classes", label: "Classes", badge: classes.length || undefined },
    { id: "methods", label: "Methods", badge: methods.length || undefined },
  ];

  if (!hasSession) {
    return (
      <PageContainer>
        <EmptyState style={{ height: "100%" }}>
          <Coffee size={48} />
          <Text $size="lg" $color="muted">No active session</Text>
          <Text $color="muted">Attach to an Android process to use Java features</Text>
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Context Menus */}
      <ContextMenu
        items={classMenuItems}
        position={classContextMenu.position}
        onClose={classContextMenu.hide}
      />
      <ContextMenu
        items={methodMenuItems}
        position={methodContextMenu.position}
        onClose={methodContextMenu.hide}
      />

      <PageHeader>
        <Flex $align="center" $gap="12px">
          <Coffee size={18} />
          <PageTitle>Java</PageTitle>
          {available === true && <Badge $variant="success">Available</Badge>}
          {available === false && <Badge $variant="error">Not Available</Badge>}
        </Flex>
      </PageHeader>

      <Toolbar>
        <Tabs items={tabItems} value={tabs.value} onChange={tabs.onChange} size="sm" />
        <ToolbarSpacer />
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Filter..." />
        <ToolbarCount total={classes.length} filtered={filteredClasses.length} />
        <ToolbarGroup>
          <Button size="sm" onClick={checkAvailable}>
            Check
          </Button>
          <IconButton
            icon={RefreshCw}
            size="sm"
            onClick={loadClasses}
            disabled={loading || available === false}
            tooltip="Load classes"
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
            <TabPanel value="classes" activeTab={tabs.value}>
              {filteredClasses.length === 0 ? (
                <EmptyState>
                  <Coffee size={32} />
                  <Text $color="muted">No classes loaded</Text>
                  <Button size="sm" onClick={loadClasses} disabled={available === false}>
                    Load Classes
                  </Button>
                </EmptyState>
              ) : (
                <Table size="sm" hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Class Name</TableHeader>
                      <TableHeader width="60px" align="center">Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredClasses.slice(0, 500).map((cls) => (
                      <TableRow
                        key={cls}
                        selected={selectedClass === cls}
                        clickable
                        onClick={() => handleClassSelect(cls)}
                        onContextMenu={(e) => handleClassContextMenu(e, cls)}
                      >
                        <TableCell mono>{cls}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            icon={Copy}
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(cls);
                            }}
                            tooltip="Copy"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabPanel>

            <TabPanel value="methods" activeTab={tabs.value}>
              {!selectedClass ? (
                <EmptyState>
                  <Text $color="muted">Select a class to view methods</Text>
                </EmptyState>
              ) : methods.length === 0 ? (
                <EmptyState>
                  <Text $color="muted">No methods found</Text>
                </EmptyState>
              ) : (
                <Table size="sm" hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Method</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {methods.map((method, i) => (
                      <TableRow
                        key={i}
                        clickable
                        onContextMenu={(e) => handleMethodContextMenu(e, method)}
                      >
                        <TableCell mono>{method}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabPanel>
          </>
        )}
      </PageContent>
    </PageContainer>
  );
}

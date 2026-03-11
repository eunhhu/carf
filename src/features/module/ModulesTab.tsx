import { For, Show, Switch, Match, onMount } from "solid-js";
import {
  moduleState,
  moduleExports,
  moduleImports,
  moduleSymbols,
  filteredModules,
  moduleSearchQuery,
  setModuleSearchQuery,
  selectModule,
  selectedModuleInfo,
  moduleSubTab,
  setModuleSubTab,
  fetchModules,
  fetchModuleExports,
  fetchModuleImports,
  fetchModuleSymbols,
} from "./module.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { formatAddress, formatSize } from "~/lib/format";
import { consumeNavigationContext } from "~/lib/navigation";
import { SplitPane } from "~/components/SplitPane";
import { CopyButton } from "~/components/CopyButton";
import { VirtualList } from "~/components/VirtualList";
import {
  ActionPopover,
  buildAddressActions,
  buildModuleActions,
  buildSymbolActions,
} from "~/components/ActionPopover";
import { InlineActions } from "~/components/InlineActions";
import { navigateTo } from "~/lib/navigation";

function ModulesTab() {
  onMount(() => {
    const session = activeSession();
    if (session) {
      void fetchModules(session.id);
    }

    const context = consumeNavigationContext();
    if (!session || !context) return;

    if (typeof context.moduleName === "string") {
      setModuleSearchQuery(context.moduleName);
      handleSelectModule(context.moduleName);
    } else if (typeof context.name === "string") {
      setModuleSearchQuery(context.name);
      handleSelectModule(context.name);
    }
  });

  function handleSelectModule(name: string): void {
    selectModule(name);
    const session = activeSession();
    if (session) {
      void fetchModuleExports(session.id, name);
    }
  }

  const moduleList = (
    <Show
      when={!moduleState.loading}
      fallback={
        <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
          Loading modules...
        </div>
      }
    >
      <VirtualList
        items={filteredModules()}
        itemHeight={34}
        resetKey={moduleSearchQuery()}
        class="h-full overflow-auto"
        empty={
          <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No modules loaded
          </div>
        }
      >
        {(mod) => {
          const isSelected = () => moduleState.selectedModule === mod.name;
          return (
            <div
              class={cn(
                "group/row flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-surface-hover",
                isSelected() && "bg-muted",
              )}
              onClick={() => handleSelectModule(mod.name)}
            >
              <ActionPopover
                type="address"
                value={mod.base}
                actions={buildAddressActions(mod.base, mod.name)}
              >
                {formatAddress(mod.base)}
              </ActionPopover>
              <span class="min-w-0 flex-1 truncate" title={mod.name}>
                {mod.name}
              </span>
              <span class="shrink-0 text-muted-foreground">
                {formatSize(mod.size)}
              </span>
              <CopyButton value={mod.base} />
            </div>
          );
        }}
      </VirtualList>
    </Show>
  );

  const moduleDetail = (
    <div class="h-full overflow-auto">
      <Show
        when={selectedModuleInfo()}
        fallback={
          <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
            Select a module to view details
          </div>
        }
      >
        {(mod) => (
          <div class="p-4">
            <div class="mb-2 flex items-center gap-2">
              <h3 class="text-sm font-semibold">{mod().name}</h3>
              <CopyButton value={mod().name} />
            </div>
            <div class="mb-4 space-y-1 text-xs">
              <div class="flex items-center gap-2">
                <span class="w-14 text-muted-foreground">Base:</span>
                <ActionPopover
                  type="address"
                  value={mod().base}
                  actions={buildAddressActions(mod().base, mod().name)}
                >
                  {formatAddress(mod().base)}
                </ActionPopover>
                <CopyButton value={mod().base} />
              </div>
              <div class="flex gap-2">
                <span class="w-14 text-muted-foreground">Size:</span>
                <span>{formatSize(mod().size)}</span>
              </div>
              <div class="flex gap-2">
                <span class="w-14 text-muted-foreground">Path:</span>
                <span class="min-w-0 break-all" title={mod().path}>{mod().path}</span>
                <CopyButton value={mod().path} />
              </div>
            </div>

            {/* Sub-tabs: Exports, Imports, Symbols */}
            <div class="border-t pt-3">
              <div class="flex gap-2 text-xs text-muted-foreground">
                <For each={["exports", "imports", "symbols"] as const}>
                  {(tab) => (
                    <button
                      class={cn(
                        "cursor-pointer rounded px-2 py-0.5 capitalize transition-colors",
                        moduleSubTab() === tab
                          ? "bg-muted text-foreground"
                          : "hover:text-foreground",
                      )}
                      onClick={() => {
                        setModuleSubTab(tab);
                        const session = activeSession();
                        if (!session || !moduleState.selectedModule) return;
                        if (tab === "imports" && moduleImports().length === 0) {
                          fetchModuleImports(session.id, moduleState.selectedModule);
                        } else if (tab === "symbols" && moduleSymbols().length === 0) {
                          fetchModuleSymbols(session.id, moduleState.selectedModule);
                        }
                      }}
                    >
                      {tab}
                      <Show when={tab === "exports" && moduleExports().length > 0}>
                        <span class="ml-1 text-[10px] text-muted-foreground">({moduleExports().length})</span>
                      </Show>
                      <Show when={tab === "imports" && moduleImports().length > 0}>
                        <span class="ml-1 text-[10px] text-muted-foreground">({moduleImports().length})</span>
                      </Show>
                      <Show when={tab === "symbols" && moduleSymbols().length > 0}>
                        <span class="ml-1 text-[10px] text-muted-foreground">({moduleSymbols().length})</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              <div class="mt-2">
                <Switch>
                  {/* Exports */}
                  <Match when={moduleSubTab() === "exports"}>
                    <Show
                      when={!moduleState.exportsLoading}
                      fallback={<div class="py-4 text-center text-xs text-muted-foreground">Loading exports...</div>}
                    >
                      <For each={moduleExports()}>
                        {(exp) => (
                          <div class="group/row flex items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors hover:bg-surface-hover">
                            <ActionPopover
                              type="address"
                              value={exp.address}
                              actions={buildAddressActions(exp.address, mod().name)}
                            >
                              {formatAddress(exp.address)}
                            </ActionPopover>
                            <span class={cn(
                              "shrink-0 rounded px-1 py-0.5 text-[10px]",
                              exp.type === "function" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning",
                            )}>
                              {exp.type === "function" ? "fn" : "var"}
                            </span>
                            <ActionPopover
                              type="symbol"
                              value={exp.name}
                              actions={buildSymbolActions(exp.name, exp.address, mod().name)}
                              class="min-w-0 truncate"
                            >
                              {exp.name}
                            </ActionPopover>
                            <InlineActions
                              primary={[
                                {
                                  label: "Hook",
                                  variant: "primary",
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    navigateTo({ tab: "native", context: { address: exp.address, action: "hook" } });
                                  },
                                },
                              ]}
                              overflow={[
                                { label: "Copy Address", onClick: () => navigator.clipboard.writeText(exp.address) },
                                { label: "Copy Name", onClick: () => navigator.clipboard.writeText(exp.name) },
                                { label: "View in Memory", onClick: () => navigateTo({ tab: "memory", context: { address: exp.address, action: "hexview" } }) },
                                { label: "Pin to Pinboard", separator: true, onClick: () => navigateTo({ tab: "pinboard", context: { type: "symbol", value: exp.name, label: exp.address } }) },
                              ]}
                            />
                          </div>
                        )}
                      </For>
                      <Show when={moduleExports().length === 0}>
                        <div class="py-4 text-center text-xs text-muted-foreground">No exports loaded</div>
                      </Show>
                    </Show>
                  </Match>

                  {/* Imports */}
                  <Match when={moduleSubTab() === "imports"}>
                    <Show
                      when={!moduleState.importsLoading}
                      fallback={<div class="py-4 text-center text-xs text-muted-foreground">Loading imports...</div>}
                    >
                      <For each={moduleImports()}>
                        {(imp) => (
                          <div class="group/row flex items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors hover:bg-surface-hover">
                            <Show
                              when={imp.address}
                              fallback={<span class="shrink-0 font-mono text-muted-foreground">-</span>}
                            >
                              <ActionPopover
                                type="address"
                                value={imp.address!}
                                actions={buildAddressActions(imp.address!, imp.module ?? undefined)}
                              >
                                {formatAddress(imp.address!)}
                              </ActionPopover>
                            </Show>
                            <Show when={imp.module}>
                              <ActionPopover
                                type="module"
                                value={imp.module!}
                                actions={buildModuleActions(imp.module!)}
                                class="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px]"
                              >
                                {imp.module}
                              </ActionPopover>
                            </Show>
                            <span class="min-w-0 truncate font-mono" title={imp.name}>{imp.name}</span>
                            <InlineActions
                              primary={[
                                {
                                  label: "Hook",
                                  variant: "primary",
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    const target = imp.address ?? (imp.module ? `${imp.module}!${imp.name}` : imp.name);
                                    navigateTo({ tab: "native", context: { address: target, action: "hook" } });
                                  },
                                },
                              ]}
                              overflow={[
                                { label: "Copy Name", onClick: () => navigator.clipboard.writeText(imp.name) },
                                ...(imp.address ? [{ label: "Copy Address", onClick: () => navigator.clipboard.writeText(imp.address!) }] : []),
                                ...(imp.module ? [{ label: "View Module", onClick: () => navigateTo({ tab: "modules", context: { moduleName: imp.module! } }) }] : []),
                              ]}
                            />
                          </div>
                        )}
                      </For>
                      <Show when={moduleImports().length === 0}>
                        <div class="py-4 text-center text-xs text-muted-foreground">No imports loaded</div>
                      </Show>
                    </Show>
                  </Match>

                  {/* Symbols */}
                  <Match when={moduleSubTab() === "symbols"}>
                    <Show
                      when={!moduleState.symbolsLoading}
                      fallback={<div class="py-4 text-center text-xs text-muted-foreground">Loading symbols...</div>}
                    >
                      <For each={moduleSymbols()}>
                        {(sym) => (
                          <div class="group/row flex items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors hover:bg-surface-hover">
                            <ActionPopover
                              type="address"
                              value={sym.address}
                              actions={buildAddressActions(sym.address, mod().name)}
                            >
                              {formatAddress(sym.address)}
                            </ActionPopover>
                            <span class={cn(
                              "shrink-0 rounded px-1 py-0.5 text-[10px]",
                              sym.type === "function" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                            )}>
                              {sym.type === "function" ? "fn" : sym.type}
                            </span>
                            <ActionPopover
                              type="symbol"
                              value={sym.name}
                              actions={buildSymbolActions(sym.name, sym.address, mod().name)}
                              class="min-w-0 truncate"
                            >
                              {sym.name}
                            </ActionPopover>
                            <InlineActions
                              primary={[
                                {
                                  label: "Hook",
                                  variant: "primary",
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    navigateTo({ tab: "native", context: { address: sym.address, action: "hook" } });
                                  },
                                },
                              ]}
                              overflow={[
                                { label: "Copy Address", onClick: () => navigator.clipboard.writeText(sym.address) },
                                { label: "Copy Name", onClick: () => navigator.clipboard.writeText(sym.name) },
                                { label: "View in Memory", onClick: () => navigateTo({ tab: "memory", context: { address: sym.address, action: "hexview" } }) },
                              ]}
                            />
                          </div>
                        )}
                      </For>
                      <Show when={moduleSymbols().length === 0}>
                        <div class="py-4 text-center text-xs text-muted-foreground">No symbols loaded</div>
                      </Show>
                    </Show>
                  </Match>
                </Switch>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Modules</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {moduleState.modules.length}
          </span>
        </div>
        <input
          type="text"
          class="rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder="Search modules..."
          value={moduleSearchQuery()}
          onInput={(e) => setModuleSearchQuery(e.currentTarget.value)}
        />
      </div>

      {/* Split view: Module list + Detail */}
      <SplitPane
        id="modules"
        left={moduleList}
        right={moduleDetail}
        minLeft={200}
        maxLeft={400}
        defaultLeft={280}
      />
    </div>
  );
}

export default ModulesTab;
